import { NextRequest } from 'next/server';

export const runtime = 'nodejs';

const AGENT_SERVICE_URL = process.env.AGENT_SERVICE_URL || process.env.ORCHESTRATOR_URL || 'http://localhost:8081';

/**
 * Stream an agent run.
 *
 * NOTE (self-hosted / sre-agent direct mode):
 * web_ui was originally designed to talk to the orchestrator's
 * `POST /agents/{name}/run/stream` endpoint. In this deployment AGENT_SERVICE_URL
 * points directly at the sre-agent (server_simple.py), which exposes
 * `POST /investigate` with a different SSE event vocabulary
 * (thought / tool_start / tool_end / result / error).
 *
 * This route forwards to /investigate and translates those events into the
 * shape that useAgentStream expects (agent_started / tool_started /
 * tool_completed / message / agent_completed).
 */
export async function POST(request: NextRequest) {
  const token = request.cookies.get('incidentfox_session_token')?.value;

  if (!token) {
    return new Response(JSON.stringify({ error: 'Not authenticated' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const body = await request.json();
    const { message, previous_response_id } = body;

    if (!message) {
      return new Response(JSON.stringify({ error: 'Missing message' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Forward to sre-agent's /investigate endpoint
    const upstreamUrl = `${AGENT_SERVICE_URL}/investigate`;
    const upstreamRes = await fetch(upstreamUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-IncidentFox-Team-Token': token,
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        prompt: message,
        thread_id: previous_response_id || undefined,
      }),
    });

    if (!upstreamRes.ok) {
      const errorText = await upstreamRes.text();
      return new Response(
        JSON.stringify({ error: errorText || `Upstream error: ${upstreamRes.status}` }),
        { status: upstreamRes.status, headers: { 'Content-Type': 'application/json' } },
      );
    }

    const { readable, writable } = new TransformStream();
    const writer = writable.getWriter();
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();

    const emit = (obj: Record<string, unknown>) =>
      writer.write(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));

    (async () => {
      const reader = upstreamRes.body?.getReader();
      if (!reader) {
        await writer.close();
        return;
      }

      let toolSeq = 0;
      let buffer = '';

      await emit({ type: 'agent_started' });

      const handle = async (ev: Record<string, unknown>) => {
        const t = ev?.type as string;
        const d = (ev?.data || {}) as Record<string, unknown>;

        if (t === 'thought') {
          if (d.text) await emit({ type: 'message', content: d.text });
        } else if (t === 'tool_start') {
          toolSeq += 1;
          await emit({
            type: 'tool_started',
            tool: d.name || 'tool',
            input: d.input || {
              command: d.command,
              file_path: d.file_path,
              pattern: d.pattern,
            },
            sequence: toolSeq,
          });
        } else if (t === 'tool_end') {
          await emit({
            type: 'tool_completed',
            sequence: toolSeq,
            output_preview:
              (d.summary as string) ||
              (d.output as string) ||
              (d.success ? 'done' : (d.error as string) || 'failed'),
          });
        } else if (t === 'result') {
          await emit({
            type: 'agent_completed',
            output: (d.text as string) || '',
            success: d.success !== false,
            last_response_id: ev.thread_id,
          });
        } else if (t === 'error') {
          await emit({
            type: 'agent_completed',
            success: false,
            error: (d.message as string) || (d.text as string) || 'error',
          });
        }
        // approval / question / question_timeout are not handled in this simple flow
      };

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          let idx: number;
          while ((idx = buffer.indexOf('\n\n')) >= 0) {
            const rawEvent = buffer.slice(0, idx);
            buffer = buffer.slice(idx + 2);
            for (const line of rawEvent.split('\n')) {
              const trimmed = line.trimStart();
              if (trimmed.startsWith('data:')) {
                const jsonStr = trimmed.slice(5).trim();
                if (!jsonStr) continue;
                try {
                  await handle(JSON.parse(jsonStr));
                } catch {
                  // ignore malformed event lines
                }
              }
            }
          }
        }
      } catch {
        // upstream connection closed
      } finally {
        await writer.close();
      }
    })();

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no',
      },
    });
  } catch (e: unknown) {
    const errorMessage = e instanceof Error ? e.message : 'Failed to stream agent';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
