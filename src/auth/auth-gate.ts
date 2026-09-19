import { authClient } from "./auth-client";
import { brandMark } from "../brand";

interface AccessParent {
  role: "parent";
  user: { id: string; name: string; email: string };
  unread: number;
}

interface AccessChild {
  role: "child";
  child: { id: string; name: string };
}

export type Access = AccessParent | AccessChild;

interface FamilyData {
  children: { id: string; name: string; loginCode: string; createdAt: number }[];
  notifications: { id: string; message: string; createdAt: number; readAt: number | null; childName: string }[];
}

function escapeHtml(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  headers.set("Content-Type", "application/json");
  const response = await fetch(path, { credentials: "include", ...init, headers });
  const body = await response.json() as T & { error?: string };
  if (!response.ok) throw new Error(body.error ?? "Không thể kết nối. Vui lòng thử lại.");
  return body;
}

function formText(data: FormData, name: string): string {
  const value = data.get(name);
  return typeof value === "string" ? value : "";
}

export async function getAccess(): Promise<Access | null> {
  try { return await api<Access>("/api/access"); }
  catch { return null; }
}

export class AuthGate {
  public constructor(private readonly host: HTMLElement, private readonly onEnter: (access: Access) => void) {}

  public async initialize(): Promise<void> {
    this.renderLoading();
    const access = await getAccess();
    if (access?.role === "parent") await this.renderParent(access);
    else if (access?.role === "child") this.onEnter(access);
    else this.renderGuest("parent-login");
  }

  private renderLoading(): void {
    this.host.innerHTML = `<main class="auth-shell"><section class="auth-card auth-loading" aria-live="polite">${brandMark("brand-mark brand-mark-loading")}<span class="auth-spinner"></span><p>Đang mở CurioLab…</p></section></main>`;
  }

  private renderGuest(active: "parent-login" | "parent-register" | "child-login", message = ""): void {
    const isRegister = active === "parent-register";
    const isChild = active === "child-login";
    this.host.innerHTML = `
      <main class="auth-shell auth-landing">
        <div class="auth-stage">
          <section class="brand-hero" aria-labelledby="brand-headline">
            <div class="brand-lockup">${brandMark()}<strong>CurioLab</strong></div>
            <p class="brand-overline">PHÒNG THÍ NGHIỆM TÒ MÒ</p>
            <h1 id="brand-headline">Tò mò.<br /><span>Lắp thử.</span><br />Hiểu thật.</h1>
            <p class="brand-promise">Một không gian 3D để trẻ biến câu hỏi thành mô hình, quan sát điều xảy ra và tự cải tiến bằng bằng chứng.</p>
            <div class="brand-journey" aria-label="Ba bước học tại CurioLab">
              <span><b>01</b> Nghĩ</span><i></i><span><b>02</b> Lắp</span><i></i><span><b>03</b> Thử</span>
            </div>
            <p class="brand-parent-note">Dành cho trẻ 9–13 tuổi · Phụ huynh quản lý tài khoản</p>
          </section>
          <section class="auth-card" aria-labelledby="auth-title">
          <div class="auth-brand">${brandMark("brand-mark brand-mark-auth")}<div><p class="eyebrow">CURIOLAB · KHU VỰC GIA ĐÌNH</p><h2 id="auth-title">${isChild ? "Bé vào phòng lab" : isRegister ? "Tạo tài khoản phụ huynh" : "Chào mừng trở lại"}</h2></div></div>
          <p class="auth-intro">${isChild ? "Dùng mã hồ sơ và PIN do phụ huynh tạo. Bé không cần email." : "Tài khoản chính luôn thuộc về phụ huynh để quản lý hồ sơ và hoạt động của bé."}</p>
          <div class="auth-tabs" role="tablist" aria-label="Chọn cách đăng nhập">
            <button type="button" role="tab" aria-selected="${String(!isChild)}" data-tab="parent-login">Phụ huynh</button>
            <button type="button" role="tab" aria-selected="${String(isChild)}" data-tab="child-login">Trẻ em</button>
          </div>
          <form class="auth-form" data-form="${active}">
            ${!isChild && isRegister ? `<label>Họ tên phụ huynh<input name="name" autocomplete="name" required maxlength="60" /></label>` : ""}
            ${isChild
              ? `<label>Mã hồ sơ<input name="code" autocomplete="username" required maxlength="6" autocapitalize="characters" spellcheck="false" /></label><label>PIN 4 số<input name="pin" type="password" inputmode="numeric" autocomplete="current-password" required minlength="4" maxlength="4" pattern="[0-9]{4}" /></label>`
              : `<label>Email phụ huynh<input name="email" type="email" autocomplete="email" required /></label><label>Mật khẩu<input name="password" type="password" autocomplete="${isRegister ? "new-password" : "current-password"}" required minlength="8" maxlength="128" /><small>Tối thiểu 8 ký tự.</small></label>`}
            <p class="auth-error" data-role="auth-error" aria-live="polite">${escapeHtml(message)}</p>
            <button class="btn-stem btn-primary auth-submit" type="submit">${isChild ? "Vào CurioLab" : isRegister ? "Tạo tài khoản" : "Đăng nhập"}</button>
          </form>
          ${!isChild ? `<button class="auth-link" type="button" data-tab="${isRegister ? "parent-login" : "parent-register"}">${isRegister ? "Đã có tài khoản? Đăng nhập" : "Chưa có tài khoản? Đăng ký"}</button>` : ""}
          <div class="privacy-note"><strong>Quyền riêng tư của trẻ</strong><p>Chỉ lưu ảnh sản phẩm và thông tin được nhập. CurioLab không thu hoặc lưu giọng nói hay khuôn mặt của trẻ.</p></div>
        </section>
        </div>
      </main>`;
    this.host.querySelectorAll<HTMLElement>("[data-tab]").forEach((button) => {
      button.addEventListener("click", () => { this.renderGuest(button.dataset.tab as typeof active); });
    });
    this.host.querySelector<HTMLFormElement>("form")?.addEventListener("submit", (event) => { event.preventDefault(); void this.submitGuest(event.currentTarget as HTMLFormElement, active); });
  }

  private async submitGuest(form: HTMLFormElement, mode: "parent-login" | "parent-register" | "child-login"): Promise<void> {
    const submit = form.querySelector<HTMLButtonElement>("[type=submit]");
    const error = form.querySelector<HTMLElement>("[data-role=auth-error]");
    const data = new FormData(form);
    if (submit) { submit.disabled = true; submit.textContent = "Đang xử lý…"; }
    if (error) error.textContent = "";
    try {
      if (mode === "child-login") {
        await api("/api/child/login", { method: "POST", body: JSON.stringify({ code: data.get("code"), pin: data.get("pin") }) });
      } else if (mode === "parent-register") {
        const result = await authClient.signUp.email({ name: formText(data, "name"), email: formText(data, "email"), password: formText(data, "password") });
        if (result.error) throw new Error(result.error.message ?? "Không thể tạo tài khoản.");
      } else {
        const result = await authClient.signIn.email({ email: formText(data, "email"), password: formText(data, "password") });
        if (result.error) throw new Error(result.error.message ?? "Email hoặc mật khẩu chưa đúng.");
      }
      await this.initialize();
    } catch (reason) {
      if (error) error.textContent = reason instanceof Error ? reason.message : "Có lỗi xảy ra.";
      if (submit) { submit.disabled = false; submit.textContent = mode === "child-login" ? "Vào CurioLab" : mode === "parent-register" ? "Tạo tài khoản" : "Đăng nhập"; }
    }
  }

  private async renderParent(access: AccessParent, notice = ""): Promise<void> {
    let family: FamilyData;
    try { family = await api<FamilyData>("/api/family"); }
    catch (reason) { this.renderGuest("parent-login", reason instanceof Error ? reason.message : "Phiên đăng nhập đã hết hạn."); return; }
    this.host.innerHTML = `
      <main class="auth-shell"><section class="auth-card family-card" aria-labelledby="family-title">
        <div class="family-brand">${brandMark("brand-mark brand-mark-family")}<strong>CurioLab</strong></div>
        <div class="family-header"><div><p class="eyebrow">TÀI KHOẢN PHỤ HUYNH</p><h1 id="family-title">Xin chào, ${escapeHtml(access.user.name)}</h1><p>${escapeHtml(access.user.email)}</p></div><button type="button" class="auth-link" data-action="sign-out">Đăng xuất</button></div>
        ${notice ? `<p class="auth-success" role="status">${escapeHtml(notice)}</p>` : ""}
        <section class="family-section"><div class="section-title"><div><h2>Hồ sơ của bé</h2><p>Bé dùng mã hồ sơ + PIN, không cần email.</p></div></div>
          <div class="child-list">${family.children.map((child) => `<article class="child-card"><span class="child-avatar" aria-hidden="true">🧒</span><div><strong>${escapeHtml(child.name)}</strong><small>Mã đăng nhập</small><code>${escapeHtml(child.loginCode)}</code></div></article>`).join("") || `<p class="empty-family">Chưa có hồ sơ trẻ. Tạo hồ sơ đầu tiên bên dưới.</p>`}</div>
          <details class="create-child" ${family.children.length === 0 ? "open" : ""}><summary>＋ Tạo hồ sơ trẻ</summary><form data-form="create-child"><label>Tên hiển thị của bé<input name="name" required maxlength="40" autocomplete="off" /></label><label>PIN 4 số<input name="pin" type="password" required inputmode="numeric" pattern="[0-9]{4}" minlength="4" maxlength="4" autocomplete="new-password" /></label><p class="auth-error" data-role="child-error" aria-live="polite"></p><button class="btn-stem btn-primary" type="submit">Tạo hồ sơ</button></form></details>
        </section>
        <section class="family-section"><div class="section-title"><div><h2>Hoạt động đăng nhập</h2><p>Phụ huynh nhận thông tin mỗi khi bé đăng nhập.</p></div>${family.notifications.some((item) => item.readAt === null) ? `<button type="button" class="auth-link" data-action="read-all">Đánh dấu đã đọc</button>` : ""}</div>
          <div class="notification-list">${family.notifications.map((item) => `<article class="notification-item ${item.readAt === null ? "unread" : ""}"><span aria-hidden="true">${item.readAt === null ? "●" : "○"}</span><div><p>${escapeHtml(item.message)}</p><time>${new Date(item.createdAt).toLocaleString("vi-VN")}</time></div></article>`).join("") || `<p class="empty-family">Chưa có hoạt động đăng nhập.</p>`}</div>
        </section>
        <button class="btn-stem btn-primary enter-lab" type="button" data-action="enter">Vào CurioLab với tư cách phụ huynh</button>
        <div class="privacy-note"><strong>Dữ liệu tối giản</strong><p>Chỉ lưu tài khoản phụ huynh, hồ sơ trẻ, lịch sử đăng nhập, ảnh sản phẩm và thông tin được nhập. Không thu hoặc lưu voice/khuôn mặt trẻ.</p></div>
      </section></main>`;
    this.host.querySelector("[data-action=enter]")?.addEventListener("click", () => { this.onEnter(access); });
    this.host.querySelector("[data-action=sign-out]")?.addEventListener("click", () => { void authClient.signOut().then(() => this.initialize()); });
    this.host.querySelector("[data-action=read-all]")?.addEventListener("click", () => { void api("/api/notifications/read", { method: "POST", body: "{}" }).then(() => this.renderParent({ ...access, unread: 0 })); });
    this.host.querySelector<HTMLFormElement>("[data-form=create-child]")?.addEventListener("submit", (event) => { event.preventDefault(); void this.createChild(event.currentTarget as HTMLFormElement, access); });
  }

  private async createChild(form: HTMLFormElement, access: AccessParent): Promise<void> {
    const data = new FormData(form);
    const error = form.querySelector<HTMLElement>("[data-role=child-error]");
    const submit = form.querySelector<HTMLButtonElement>("[type=submit]");
    if (submit) submit.disabled = true;
    try {
      const result = await api<{ child: { name: string; loginCode: string } }>("/api/children", { method: "POST", body: JSON.stringify({ name: data.get("name"), pin: data.get("pin") }) });
      await this.renderParent(access, `Đã tạo hồ sơ ${result.child.name}. Mã đăng nhập của bé là ${result.child.loginCode}.`);
    } catch (reason) {
      if (error) error.textContent = reason instanceof Error ? reason.message : "Không thể tạo hồ sơ.";
      if (submit) submit.disabled = false;
    }
  }
}

export function mountAccountDock(access: Access, onReturn: () => void): void {
  const dock = document.createElement("button");
  dock.type = "button";
  dock.className = "account-dock";
  dock.setAttribute("aria-label", "Mở tài khoản và đổi hồ sơ");
  dock.innerHTML = `<span aria-hidden="true">${access.role === "parent" ? "👨‍👩‍👧" : "🧒"}</span><span>${escapeHtml(access.role === "parent" ? access.user.name : access.child.name)}</span>${access.role === "parent" && access.unread > 0 ? `<b aria-label="${String(access.unread)} thông báo mới">${String(access.unread)}</b>` : ""}`;
  dock.addEventListener("click", onReturn);
  document.body.append(dock);
}
