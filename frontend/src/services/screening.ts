export async function screenVideo(file: File) {
  const formData = new FormData();
  formData.append("video", file);

  const apiBase = import.meta.env.VITE_API_URL;
  if (!apiBase) {
    throw new Error("VITE_API_URL is not set. Configure the frontend API base URL.");
  }

  const res = await fetch(
    `${apiBase}/api/screening/screen`,
    {
      method: "POST",
      body: formData,
    }
  );

  if (!res.ok) {
    let message = `Screening failed (${res.status})`;
    try {
      const data = await res.json();
      if (data?.error) {
        message = data.error;
      }
    } catch {
      try {
        const text = await res.text();
        if (text) {
          message = text;
        }
      } catch {
        // Ignore parse errors
      }
    }
    throw new Error(message);
  }

  return res.json();
}
