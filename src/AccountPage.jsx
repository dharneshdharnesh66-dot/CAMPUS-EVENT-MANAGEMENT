import { useState } from 'react'
import { api } from './api.js'
import './UserPage.css'

export default function AccountPage({ user, onUpdate, onNavigate, onLogout }) {
  const isAdmin = user.role === 'admin'
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState({ name: user.name, course: user.course || '', year: user.year || '', bio: user.bio || '' })
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  async function save(event) {
    event.preventDefault()
    setBusy(true); setError(''); setMessage('')
    try {
      const data = await api('/profile', { method: 'PATCH', body: draft })
      onUpdate(data.user)
      setEditing(false)
      setMessage('Your profile has been saved.')
    } catch (error) { setError(error.message) } finally { setBusy(false) }
  }

  return <div className="profile-page">
    <aside className="profile-sidebar">
      <button className="profile-brand account-brand" onClick={() => onNavigate('student')}><span>C</span> CampusConnect</button>
      <p className="sidebar-label">YOUR WORKSPACE</p>
      <nav aria-label="Account screens">
        <span className="active-screen" aria-current="page"><span aria-hidden="true">◎</span> User profile</span>
        {isAdmin ? <button onClick={() => onNavigate('admin')}>◇ Manage events</button> : <button onClick={() => onNavigate('student')}>▦ Student dashboard</button>}
        <button onClick={() => onNavigate('events')}>CC Events</button>
        <button onClick={onLogout}>Sign out ↗</button>
      </nav>
      <div className="sidebar-note"><span>THIS IS YOUR SPACE</span><p>A little about you.<br />A lot to explore.</p><div aria-hidden="true">CC</div></div>
      <div className="sidebar-account"><div className="mini-avatar">{user.name.charAt(0).toUpperCase()}</div><div><strong>{user.name}</strong><span>{user.role}</span></div></div>
    </aside>
    <main className="profile-main">
      <header className="profile-topbar"><span>Workspace / <strong>User profile</strong></span><span className="profile-demo">Signed in as {user.email}</span></header>
      <div className="profile-content">
        <div className="profile-heading"><div><span className="profile-eyebrow">MAKE YOURSELF AT HOME</span><h1>{isAdmin ? 'Your admin profile.' : 'Your campus identity.'}</h1><p>Update the details saved to your account.</p></div></div>
        <section className="identity-card" aria-labelledby="identity-title">
          <div className="identity-banner"><span>HELLO, CAMPUS.</span><span aria-hidden="true">CC</span></div>
          <div className="identity-body"><div className="profile-avatar" aria-hidden="true">{user.name.split(' ').filter(Boolean).slice(0, 2).map(part => part.charAt(0)).join('').toUpperCase()}</div><div className="identity-name"><span className="student-label">{user.role.toUpperCase()} ACCOUNT</span><h2 id="identity-title">{user.name}</h2><p>{isAdmin ? 'Event management administrator' : [user.course, user.year].filter(Boolean).join(' · ') || 'Add your course and year below'}</p></div><button className="edit-profile" disabled={busy} onClick={() => { setDraft({ name: user.name, course: user.course || '', year: user.year || '', bio: user.bio || '' }); setEditing(!editing); setMessage(''); setError('') }}>{editing ? 'Close editor' : 'Edit profile'} ↗</button></div>
        </section>
        {message && <p className="profile-success" role="status">{message}</p>}
        {error && <p className="account-error" role="alert">{error}</p>}
        <section className="profile-card" style={{ marginTop: 24 }}>
          <div className="card-title"><h2>{editing ? 'Edit your details' : 'About you'}</h2><span>01</span></div>
          {editing ? <form className="profile-form" onSubmit={save}>
            <label>Full name<input required maxLength={60} value={draft.name} onChange={event => setDraft({ ...draft, name: event.target.value })} /></label>
            {!isAdmin && <div className="profile-form-row"><label>Course<input maxLength={40} value={draft.course} onChange={event => setDraft({ ...draft, course: event.target.value })} /></label><label>Year<select aria-label="Academic year" value={draft.year} onChange={event => setDraft({ ...draft, year: event.target.value })}><option value="">Select year</option><option>First year</option><option>Second year</option><option>Third year</option><option>Fourth year</option></select></label></div>}
            <label>Short bio<textarea rows={3} maxLength={200} value={draft.bio} onChange={event => setDraft({ ...draft, bio: event.target.value })} /></label>
            <p className="profile-hint">Your account email stays {user.email}. Saving updates your profile in the database.</p>
            <div className="profile-form-actions"><button type="button" disabled={busy} onClick={() => setEditing(false)}>Cancel</button><button disabled={busy} type="submit">{busy ? 'Saving...' : 'Save changes'}</button></div>
          </form> : <><p className="profile-bio">{user.bio || 'You have not added a bio yet.'}</p><dl className="profile-details"><div><dt>Email address</dt><dd>{user.email}</dd></div>{!isAdmin && <><div><dt>Course</dt><dd>{user.course || 'Not added'}</dd></div><div><dt>Academic year</dt><dd>{user.year || 'Not added'}</dd></div></>}<div><dt>Account role</dt><dd>{user.role}</dd></div>{!isAdmin && <div><dt>Student ID</dt><dd>{user.studentId}</dd></div>}</dl></>}
        </section>
        <footer className="profile-footer"><span>Campus Event Management System</span><span>Your profile is saved in MongoDB</span></footer>
      </div>
    </main>
  </div>
}
