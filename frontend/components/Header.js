import { html } from 'htm/preact'

export default function Header({ user }) {
  return html`
    <header class="header">
      <div class="header-logo">k8s<span>job</span></div>
      ${user && html`
        <div class="header-user">
          <img src=${user.avatar_url} alt=${user.login} width="28" height="28" />
          <span>${user.login}</span>
          <a href="/auth/logout" class="btn btn-ghost">Sign out</a>
        </div>
      `}
    </header>
  `
}
