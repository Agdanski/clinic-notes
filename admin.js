const statusLine = document.getElementById("adminStatus");

async function api(path, options = {}) {
  const response = await fetch(path, {
    credentials: "same-origin",
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Request failed.");
  return data;
}

async function loadUsers() {
  const { users } = await api("/api/users");
  const mount = document.getElementById("userList");
  mount.innerHTML = "";
  users.forEach((user) => {
    const card = document.createElement("article");
    card.innerHTML = `
      <strong>${escapeHtml(user.display_name)}</strong>
      <span>${escapeHtml(user.username)} - ${escapeHtml(user.role)}${user.disabled ? " - disabled" : ""}</span>
    `;
    mount.appendChild(card);
  });
}

async function loadAudit() {
  const { events } = await api("/api/audit?limit=80");
  const mount = document.getElementById("auditList");
  mount.innerHTML = "";
  events.forEach((event) => {
    const row = document.createElement("article");
    row.innerHTML = `
      <time>${escapeHtml(event.created_at)}</time>
      <strong>${escapeHtml(event.action)}</strong>
      <span>${escapeHtml(event.username || "system")} - ${escapeHtml(event.summary || "")}</span>
    `;
    mount.appendChild(row);
  });
}

document.getElementById("userForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  statusLine.textContent = "Creating user...";
  try {
    await api("/api/users", {
      method: "POST",
      body: JSON.stringify({
        username: document.getElementById("newUsername").value,
        displayName: document.getElementById("newDisplayName").value,
        role: document.getElementById("newRole").value,
        password: document.getElementById("newPassword").value
      })
    });
    event.target.reset();
    statusLine.textContent = "User created.";
    await Promise.all([loadUsers(), loadAudit()]);
  } catch (error) {
    statusLine.textContent = error.message;
  }
});

document.getElementById("backupNow").addEventListener("click", async () => {
  statusLine.textContent = "Creating backup...";
  try {
    const result = await api("/api/backups", { method: "POST", body: "{}" });
    statusLine.textContent = `Backup created: ${result.backupDir}`;
    await loadAudit();
  } catch (error) {
    statusLine.textContent = error.message;
  }
});

function escapeHtml(value) {
  return String(value || "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]);
}

Promise.all([loadUsers(), loadAudit()]).catch((error) => {
  statusLine.textContent = error.message;
});
