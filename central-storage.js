(function () {
  const CLINIC_KEYS = [
    "clinic-patient-profiles-v1",
    "clinic-repeat-soap-drafts-v2",
    "clinic-initial-visit-records-v1",
    "clinic-vsc-exam-records-v1",
    "clinic-informed-consents-v1",
    "clinic-diagnostic-reports-v1"
  ];

  if (!/^https?:$/.test(window.location.protocol)) return;
  if (window.location.pathname.endsWith("/login.html")) return;

  const native = {
    getItem: Storage.prototype.getItem,
    setItem: Storage.prototype.setItem,
    removeItem: Storage.prototype.removeItem
  };
  let syncing = false;

  function serverGetStorage() {
    const xhr = new XMLHttpRequest();
    xhr.open("GET", "/api/storage", false);
    xhr.setRequestHeader("Accept", "application/json");
    try {
      xhr.send();
      if (xhr.status === 401) {
        window.location.replace(`/login.html?next=${encodeURIComponent(window.location.pathname + window.location.search)}`);
        return null;
      }
      if (xhr.status >= 200 && xhr.status < 300) return JSON.parse(xhr.responseText || "{}").storage || {};
    } catch (error) {
      console.warn("Clinic server storage unavailable.", error);
    }
    return null;
  }

  function serverSet(key, value) {
    if (syncing || !CLINIC_KEYS.includes(key)) return;
    fetch(`/api/storage/${encodeURIComponent(key)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ value: String(value ?? "") }),
      keepalive: String(value || "").length < 60000
    }).catch((error) => console.warn("Could not save to clinic server.", error));
  }

  function serverRemove(key) {
    if (syncing || !CLINIC_KEYS.includes(key)) return;
    fetch(`/api/storage/${encodeURIComponent(key)}`, {
      method: "DELETE",
      credentials: "same-origin",
      keepalive: true
    }).catch((error) => console.warn("Could not delete from clinic server.", error));
  }

  function audit(action, summary, metadata) {
    fetch("/api/audit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ action, summary, metadata }),
      keepalive: true
    }).catch(() => {});
  }

  function bootstrap() {
    const serverStorage = serverGetStorage();
    if (!serverStorage) return;
    syncing = true;
    const serverHasAnyRecords = Object.keys(serverStorage).length > 0;
    const localMigrations = [];
    CLINIC_KEYS.forEach((key) => {
      if (Object.prototype.hasOwnProperty.call(serverStorage, key)) {
        native.setItem.call(localStorage, key, serverStorage[key]);
      } else if (serverHasAnyRecords) {
        native.removeItem.call(localStorage, key);
      } else {
        const local = native.getItem.call(localStorage, key);
        if (local !== null) localMigrations.push([key, local]);
      }
    });
    syncing = false;
    localMigrations.forEach(([key, value]) => serverSet(key, value));
  }

  bootstrap();

  Storage.prototype.setItem = function patchedSetItem(key, value) {
    native.setItem.call(this, key, value);
    if (this === localStorage) serverSet(String(key), String(value));
  };

  Storage.prototype.removeItem = function patchedRemoveItem(key) {
    native.removeItem.call(this, key);
    if (this === localStorage) serverRemove(String(key));
  };

  window.ClinicServer = { audit };

  document.addEventListener("DOMContentLoaded", async () => {
    try {
      const response = await fetch("/api/me", { credentials: "same-origin" });
      if (!response.ok) return;
      const { user } = await response.json();
      const bar = document.createElement("div");
      bar.className = "server-user-bar";
      const adminLink = user.role === "admin" ? '<a href="admin.html">Admin</a>' : "";
      bar.innerHTML = `
        <span>Signed in: <strong>${escapeHtml(user.displayName || user.username)}</strong> (${escapeHtml(user.role)})</span>
        ${adminLink}
        <button type="button" id="serverLogout">Logout</button>
      `;
      document.body.appendChild(bar);
      document.getElementById("serverLogout").addEventListener("click", async () => {
        await fetch("/api/logout", { method: "POST", credentials: "same-origin" });
        syncing = true;
        CLINIC_KEYS.forEach((key) => native.removeItem.call(localStorage, key));
        syncing = false;
        window.location.href = "/login.html";
      });
      ["exportNote", "printNote", "exportInitial", "printInitial", "exportExam", "printExam", "exportConsent", "printConsent"].forEach((id) => {
        const button = document.getElementById(id);
        if (button) button.addEventListener("click", () => audit("client_record_output", `Used ${id}`, { id, path: window.location.pathname }));
      });
    } catch (error) {
      console.warn("Could not load login status.", error);
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
})();
