const API = "https://open.tiktokapis.com/v2";

export default {
  async fetch(req, env) {
    const cors = {
      "Access-Control-Allow-Origin": env.ALLOWED_ORIGIN,
      "Access-Control-Allow-Headers": "Authorization, Content-Type",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
    };
    const json = (o, s = 200) =>
      new Response(JSON.stringify(o), { status: s, headers: { ...cors, "Content-Type": "application/json" } });
    if (req.method === "OPTIONS") return new Response(null, { headers: cors });
    const { pathname } = new URL(req.url);
    const auth = req.headers.get("Authorization") || "";

    try {
      // Exchange the login code for an access token (needs the client secret)
      if (pathname === "/api/token") {
        const { code, redirect_uri } = await req.json();
        const r = await fetch(`${API}/oauth/token/`, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            client_key: env.CLIENT_KEY,
            client_secret: env.TIKTOK_CLIENT_SECRET,
            code, redirect_uri, grant_type: "authorization_code",
          }),
        });
        return json(await r.json(), r.status);
      }

      // Logged-in user's display name
      if (pathname === "/api/user") {
        const r = await fetch(`${API}/user/info/?fields=display_name,avatar_url`, { headers: { Authorization: auth } });
        return json(await r.json(), r.status);
      }

      // Send the chosen video to the user's own TikTok inbox (drafts)
      if (pathname === "/api/upload") {
        const video = await req.arrayBuffer();
        const size = video.byteLength;
        const init = await fetch(`${API}/post/publish/inbox/video/init/`, {
          method: "POST",
          headers: { Authorization: auth, "Content-Type": "application/json; charset=UTF-8" },
          body: JSON.stringify({ source_info: { source: "FILE_UPLOAD", video_size: size, chunk_size: size, total_chunk_count: 1 } }),
        }).then((r) => r.json());
        if (!init.data || !init.data.upload_url) return json(init, 400);
        const put = await fetch(init.data.upload_url, {
          method: "PUT",
          headers: { "Content-Type": req.headers.get("Content-Type") || "video/mp4", "Content-Range": `bytes 0-${size - 1}/${size}` },
          body: video,
        });
        return json({ publish_id: init.data.publish_id, upload_status: put.status }, put.ok ? 200 : 502);
      }

      // Upload status
      if (pathname === "/api/status") {
        const { publish_id } = await req.json();
        const r = await fetch(`${API}/post/publish/status/fetch/`, {
          method: "POST",
          headers: { Authorization: auth, "Content-Type": "application/json; charset=UTF-8" },
          body: JSON.stringify({ publish_id }),
        });
        return json(await r.json(), r.status);
      }
      return json({ error: "not found" }, 404);
    } catch (e) {
      return json({ error: String(e) }, 500);
    }
  },
};
