import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const ANTHROPIC_KEY = Deno.env.get("ANTHROPIC_KEY") ?? "";
const ELEVENLABS_KEY = Deno.env.get("ELEVENLABS_KEY") ?? "";
const OPENAI_KEY = Deno.env.get("OPENAI_KEY") ?? "";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "*",
};

export default {
  fetch: async (req: Request) => {
    if (req.method === "OPTIONS") {
      return new Response("ok", { headers: CORS });
    }

    const url = new URL(req.url);
    const isTTS = url.pathname.includes("/tts");
    const isWhisper = url.pathname.includes("/whisper");

    // ── WHISPER SPEECH TO TEXT ────────────────────────────────────────────────
    if (isWhisper) {
      try {
        const formData = await req.formData();
        const audio = formData.get("audio") as File;
        const lang = formData.get("lang") as string || "";

        const whisperForm = new FormData();
        whisperForm.append("file", audio, "audio.webm");
        whisperForm.append("model", "whisper-1");
        // Use a soft prompt hint instead of forcing the `language` param.
        // This tells Whisper both languages are plausible without locking it into
        // one, which avoids the failure mode where short English utterances get
        // mis-detected as the user's native language.
        if (lang && lang !== "auto") {
          whisperForm.append("language", lang.split("-")[0]);
        } else {
          whisperForm.append(
            "prompt",
            "This audio may be in English or in another language spoken by a non-native English speaker. Transcribe exactly what is said, in whichever language it is actually spoken."
          );
        }

        const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${OPENAI_KEY}`,
          },
          body: whisperForm,
        });

        const data = await response.json();
        return new Response(JSON.stringify(data), {
          headers: { ...CORS, "Content-Type": "application/json" },
        });
      } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), {
          status: 500,
          headers: { ...CORS, "Content-Type": "application/json" },
        });
      }
    }

    // ── ELEVENLABS TTS ────────────────────────────────────────────────────────
    if (isTTS) {
      try {
        const { text, lang } = await req.json();
        const voiceId = "EXAVITQu4vr4xnSDxMaL"; // Sarah - best multilingual

        const ttsResponse = await fetch(
          `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "xi-api-key": ELEVENLABS_KEY,
            },
            body: JSON.stringify({
              text: text,
              model_id: "eleven_multilingual_v2",
              voice_settings: {
                stability: 0.5,
                similarity_boost: 0.8,
                style: 0.2,
                use_speaker_boost: true,
              },
            }),
          }
        );

        if (!ttsResponse.ok) {
          const err = await ttsResponse.text();
          return new Response(JSON.stringify({ error: err }), {
            status: 500,
            headers: { ...CORS, "Content-Type": "application/json" },
          });
        }

        const audioBuffer = await ttsResponse.arrayBuffer();
        return new Response(audioBuffer, {
          headers: { ...CORS, "Content-Type": "audio/mpeg" },
        });
      } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), {
          status: 500,
          headers: { ...CORS, "Content-Type": "application/json" },
        });
      }
    }

    // ── CLAUDE AI ─────────────────────────────────────────────────────────────
    try {
      const body = await req.json();
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": ANTHROPIC_KEY,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify(body),
      });

      const text = await response.text();
      return new Response(text, {
        status: response.status,
        headers: { ...CORS, "Content-Type": "application/json" },
      });
    } catch (err) {
      return new Response(
        JSON.stringify({
          content: [{ text: JSON.stringify({ type: "bilingual", native: "خطا", english: "Error: " + err.message, sayThis: null }) }],
        }),
        { status: 200, headers: { ...CORS, "Content-Type": "application/json" } }
      );
    }
  },
};
