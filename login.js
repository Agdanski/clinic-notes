const form = document.getElementById("loginForm");
const statusLine = document.getElementById("loginStatus");

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  statusLine.textContent = "Signing in...";
  const username = document.getElementById("username").value.trim();
  const password = document.getElementById("password").value;
  try {
    const response = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ username, password })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      statusLine.textContent = data.error || "Login failed.";
      return;
    }
    const next = new URLSearchParams(window.location.search).get("next") || "/dashboard.html";
    window.location.href = next.startsWith("/") ? next : "/dashboard.html";
  } catch (error) {
    statusLine.textContent = "Could not reach the clinic server.";
    console.error(error);
  }
});
