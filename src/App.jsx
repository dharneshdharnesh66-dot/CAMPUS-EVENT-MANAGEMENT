import { useEffect, useState } from 'react'
import './App.css'
import './ApiPages.css'
import { api, loadSession } from './api.js'
import AccountPage from './AccountPage.jsx'
import { StudentPage, EventPage } from './CampusPages.jsx'
import { AdminPage, CheckoutPage } from './ManagementPages.jsx'
import { EntryTicket, EntryScanner } from './TicketPages.jsx'
import MessagesPage from './MessagesPage.jsx'

function viewEvent(event) {
  const date = new Date(event.startsAt)
  return { ...event, price: event.feePaise / 100, day: date.toLocaleDateString('en-IN', { day: '2-digit' }), month: date.toLocaleDateString('en-IN', { month: 'short' }).toUpperCase(), time: date.toLocaleString('en-IN', { year: 'numeric', hour: '2-digit', minute: '2-digit' }), color: event.type === 'College' ? 'green' : 'peach', symbol: event.type === 'College' ? '01' : '02' }
}
function WorkspaceNav({ user, page, onNavigate, onLogout, busy }) {
  const links=user.role==='admin' ? [['admin','Manage events'],['events','Events'],['scanner','Entry scanner'],['messages','Messages'],['user','User profile']] : [['student','Student dashboard'],['events','Events'],['messages','Messages'],['user','User profile']]
  return <header className="workspace-nav"><div className="workspace-nav-inner"><button className="workspace-brand" onClick={()=>onNavigate(user.role==='admin'?'admin':'student')}>CampusConnect</button><span className="workspace-role">{user.role==='admin'?'Admin workspace':'Student workspace'}</span><nav aria-label="Workspace navigation">{links.map(([key,label])=><button key={key} aria-current={page===key?'page':undefined} onClick={()=>onNavigate(key)}>{label}</button>)}<button disabled={busy} onClick={onLogout}>Sign out</button></nav></div></header>
}
const workspaceStyles = `
:root .signed-workspace {min-height:100vh;background:#f7f4ed}
:root .signed-workspace > .workspace-nav {position:sticky;top:0;z-index:100;background:linear-gradient(120deg,#182e49,#102136);color:#fffaf0;box-shadow:0 3px 14px #14263e20}
:root .workspace-nav-inner {min-height:84px;max-width:1440px;margin:auto;padding:12px clamp(18px,4vw,58px);display:flex;align-items:center;gap:18px}
:root .workspace-nav button {font:inherit;border:0;background:transparent;color:#e5eaf1;border-radius:8px;padding:12px 14px;cursor:pointer;white-space:nowrap;font-size:13px;line-height:1.4}
:root .workspace-nav .workspace-brand {font-size:21px;font-weight:750;letter-spacing:-.4px;color:#fffaf0;padding-left:0}
:root .workspace-role {color:#c7d2df;font-size:11px;white-space:nowrap}
:root .workspace-nav nav {margin-left:auto;display:flex;align-items:center;gap:6px;min-width:0}
:root .workspace-nav nav button[aria-current='page'] {background:#e7cf95;color:#14263e;font-weight:700}
:root .workspace-nav nav button:hover:not(:disabled):not([aria-current='page']) {background:#ffffff16}
:root .signed-workspace .campus-sidebar,:root .signed-workspace .profile-sidebar,:root .signed-workspace .campus-topbar,:root .signed-workspace .profile-topbar,:root .signed-workspace .management-page > header {display:none}
:root .signed-workspace .campus-page,:root .signed-workspace .profile-page {display:block;min-height:calc(100vh - 84px)}
:root .signed-workspace .management-page {min-height:calc(100vh - 84px)}
:root .signed-workspace .campus-main,:root .signed-workspace .profile-main {width:100%;min-width:0}
:root .signed-workspace .campus-content,:root .signed-workspace .profile-content {max-width:1240px;margin:auto}
@media(max-width:850px){:root .workspace-nav-inner{padding:12px 18px 0;display:grid;grid-template-columns:1fr auto;gap:4px 12px}:root .workspace-nav .workspace-brand{font-size:20px;text-align:left;padding:4px 0 8px}:root .workspace-role{font-size:10px}:root .workspace-nav nav{grid-column:1/-1;width:100%;margin:0;overflow-x:auto;padding:0 0 10px;scrollbar-width:thin;gap:5px}:root .workspace-nav nav button{flex-shrink:0;padding:10px 12px;font-size:12px}}
@media(prefers-reduced-motion:no-preference){:root .workspace-nav button{transition:background-color .15s ease}}
`
function NotificationCenter({ user, onNavigate }) {
  const [items,setItems]=useState([]), [open,setOpen]=useState(false), [error,setError]=useState(''), [loading,setLoading]=useState(false), [loaded,setLoaded]=useState(false)
  async function refresh() { setLoading(true); try { const data=await api('/notifications');setItems(data.notifications);setLoaded(true);setError('') } catch(e) {setError(e.message)} finally {setLoading(false)} }
  useEffect(()=>{ let active=true; async function check(){if(active && !document.hidden) await refresh()} check();const timer=setInterval(check,60000);document.addEventListener('visibilitychange',check);return ()=>{active=false;clearInterval(timer);document.removeEventListener('visibilitychange',check)} },[user.id])
  async function mark(ids){setLoading(true);try{await api('/notifications/read',{method:'POST',body:{ids}});setItems(prev=>prev.map(n=>ids.includes(n.id)?{...n,read:true}:n));setError('')}catch(e){setError(e.message)}finally{setLoading(false)}}
  const unread=items.filter(n=>!n.read).length
  return <section className="notification-center" aria-label="In-app notifications" style={{background:'#f5f0e3',color:'#14283e',padding:'12px clamp(16px,5vw,80px)',borderBottom:'1px solid #d7c9a7'}}>
    <style>{`.notification-center button {font:inherit;color:#14283e;background:#fff;border:1px solid #a9b8bf;border-radius:8px;padding:9px 12px;cursor:pointer;line-height:1.4}.notification-center button:hover:not(:disabled){background:#dce8ec}.notification-center button:focus-visible{outline:3px solid #816320;outline-offset:3px}.notification-center button:disabled{opacity:.55;cursor:default}.notification-center p{line-height:1.6;margin:10px 0}.notification-center h3{font-size:18px;line-height:1.4}`}</style>
    <button aria-expanded={open} aria-controls="notification-list" onClick={()=>{setOpen(!open);if(!open)refresh()}} style={{color:'#14283e',background:'#fff',border:'1px solid #b6aa8e',borderRadius:8,padding:'10px 14px'}}>Notifications {loaded?`(${unread} unread)`:error?'(unavailable)':'(loading...)'}{error?' · Check connection':''}</button>
    {open&&<div id="notification-list" style={{maxWidth:900,margin:'12px auto',overflowWrap:'anywhere'}}><h2 style={{color:'#14283e',fontSize:22}}>Your notifications</h2><p>In-app only. Checks every minute while this app is visible. No phone alerts when closed.</p><p>Latest 100 active alerts: future events posted since your account was created, and your registered events starting within 1 hour. Alerts leave this list when the event starts, is cancelled, or a registration is removed (reminders only).</p><div style={{display:'flex',gap:12,flexWrap:'wrap',margin:'12px 0'}}><button disabled={loading} onClick={refresh}>Refresh notifications</button><button disabled={loading||!unread} onClick={()=>mark(items.filter(n=>!n.read).map(n=>n.id))}>Mark all as read</button></div>{error&&<p role="alert">{error}</p>}{loading&&<p role="status">Checking notifications...</p>}{loaded&&!items.length&&!error&&<p>No current notifications. New alerts will appear here.</p>}
    {items.map(n=><article key={n.id} style={{background:n.read?'#fff':'#e9f1f4',padding:16,border:'1px solid #c6d0d6',borderRadius:10,margin:'10px 0'}}><p style={{fontSize:12}}>{n.read?'Read':'Unread'} · {n.kind==='reminder'?'Event reminder':'New event'}</p><h3 style={{color:'#14283e',margin:'8px 0'}}>{n.title}</h3><p>{n.eventTitle}</p><p>Starts: {new Date(n.startsAt).toLocaleString('en-IN')}</p><div style={{display:'flex',gap:12,flexWrap:'wrap'}}><button onClick={()=>{onNavigate('events');setOpen(false)}}>Browse events</button>{!n.read&&<button disabled={loading} onClick={()=>mark([n.id])}>Mark as read</button>}</div></article>)}
    </div>}
  </section>
}
export default function App() {
  const [user, setUser] = useState(null), [ready, setReady] = useState(false), [sessionError, setSessionError] = useState('')
  const [page, setPage] = useState('student'), [mode, setMode] = useState('login'), [busy, setBusy] = useState(false)
  const [error, setError] = useState(''), [notice, setNotice] = useState(''), [events, setEvents] = useState([]), [registrations, setRegistrations] = useState([]), [checkout, setCheckout] = useState(null)
  const [showPassword, setShowPassword] = useState(false)
  const [ticketEvent,setTicketEvent]=useState(null)
  async function boot() { setReady(false); setSessionError(''); try { const savedUser = await loadSession(); setUser(savedUser); setPage(savedUser?.role === 'admin' ? 'admin' : 'student') } catch(e) { setSessionError(e.message) } finally { setReady(true) } }
  useEffect(() => { boot() }, [])
  useEffect(() => { window.scrollTo(0,0) }, [page])
  async function refresh() { const [a,b] = await Promise.all([api('/events'), api('/registrations')]); setEvents(a.events.map(viewEvent)); setRegistrations(b.registrations.map(r => ({ ...r, event: viewEvent(r.event) }))) }
  useEffect(() => { if(user) { setBusy(true); refresh().catch(e => setError(e.message)).finally(() => setBusy(false)) } }, [user?.id])
  function navigate(next) { setPage(user?.role === 'admin' && next === 'student' ? 'admin' : next); setError(''); setNotice(''); if(next !== 'checkout') setCheckout(null) }
  async function operation(action) { if(busy) return; setBusy(true); setError(''); setNotice(''); try { return await action() } catch(e) { setError(e.message); if(e.status === 401) {setUser(null); await loadSession().catch(()=>{})} throw e } finally {setBusy(false)} }
  async function authenticate(event) { event.preventDefault(); const fields = new FormData(event.currentTarget); await operation(async () => { const d=await api('/auth/'+mode,{method:'POST',body:{email:fields.get('email'),password:fields.get('password'),...(mode==='signup'?{name:fields.get('name')}:{})}}); setEvents([]); setRegistrations([]); setUser(d.user); setPage(d.user.role==='admin'?'admin':'student') }).catch(()=>{}) }
  async function logout() { await operation(async () => {await api('/auth/logout',{method:'POST'});setUser(null);setEvents([]);setRegistrations([]);setCheckout(null);await loadSession()}).catch(()=>{}) }
  async function register(id) { await operation(async () => { const event=events.find(e=>e.id===id); if(event.feePaise===0) { await api('/events/'+id+'/register',{method:'POST'}); await refresh();setNotice('Registration saved.') } else {const d=await api('/test-payments',{method:'POST',body:{eventId:id}});setCheckout({event,payment:d.payment});setPage('checkout')} }).catch(()=>{}) }
  async function cancel(id) { await operation(async () => {await api('/events/'+id+'/registration',{method:'DELETE'});await refresh();setNotice('Registration removed.')}).catch(()=>{}) }
  async function add(event) { return operation(async () => {const d=await api('/events',{method:'POST',body:event});setEvents(previous=>[...previous,viewEvent(d.event)].sort((a,b)=>new Date(a.startsAt)-new Date(b.startsAt)))}) }
  async function cancelEvent(id) { return operation(async () => {const d=await api('/events/'+id+'/cancel',{method:'POST'});setEvents(previous=>previous.map(e=>e.id===id?viewEvent(d.event):e))}) }
  async function complete(outcome) { return operation(async () => {const d=await api('/test-payments/'+checkout.payment.id+'/complete',{method:'POST',body:{outcome}});setCheckout(previous=>({...previous,payment:d.payment}));await refresh();return d.payment.status}) }
  if(!ready) return <main className="api-status"><h1>CampusConnect</h1><p role="status">Connecting to your campus account...</p></main>
  if(sessionError) return <main className="api-status"><h1>Cannot reach the Campus server.</h1><p role="alert">{sessionError}</p><p>No login or registration has been submitted. The backend must be running before accounts and events can load.</p><button onClick={boot}>Try connection again</button></main>
  if(!user) return <main className="login-page"><section className="story-panel"><div className="brand"><span className="brand-mark">C</span> CampusConnect</div><div className="story-content"><span className="eyebrow">YOUR CAMPUS. YOUR COMMUNITY.</span><h1>Good things<br/>happen together.</h1><p>Discover events, meet your people and make your campus experience your own.</p><div className="event-preview"><div className="poster-art"><span className="art-star" aria-hidden="true">01</span><span className="art-label">CREATE.<br/>CONNECT.<br/>CELEBRATE.</span></div><div className="preview-details"><span className="sample-tag">A LITTLE INSPIRATION</span><h2>Practice makes perfect.</h2><p>Where there's a will, there's a way.</p></div></div></div><div className="story-footer">Campus Event Management System</div></section><section className="form-panel"><div className="demo-badge">Your campus workspace</div><div className="login-box"><span className="form-eyebrow">LET'S GET YOU STARTED</span><h2>{mode==='signup'?'Join your campus.':'Welcome back.'}</h2><p className="form-intro">{mode==='signup'?'Create a student account. Your student ID is generated automatically.':'Sign in to your saved account.'}</p><form onSubmit={authenticate}>
    {mode==='signup'&&<><label htmlFor="name">Full name</label><input id="name" name="name" required maxLength={60} autoComplete="name"/></>}
    <label htmlFor="email">Email address</label><input id="email" name="email" type="email" required maxLength={254} autoComplete="username"/>
    <label htmlFor="password">Password</label><div className="password-field"><input id="password" name="password" type={showPassword?'text':'password'} required minLength={mode==='signup'?12:1} maxLength={128} autoComplete={mode==='signup'?'new-password':'current-password'}/><button type="button" className="show-password" onClick={()=>setShowPassword(!showPassword)}>{showPassword?'Hide':'Show'}</button></div><p className="field-hint">{mode==='signup'?'Use 12 to 128 characters. Do not reuse an important password.':'Use the password for this Campus account.'}</p>
    {error&&<p className="account-error" role="alert">{error}</p>}<button className="sign-in" disabled={busy} type="submit">{busy?'Please wait...':mode==='signup'?'Create student account':'Sign in'} ↗</button></form><button className="api-switch" disabled={busy} onClick={()=>{setMode(mode==='signup'?'login':'signup');setError('')}}>{mode==='signup'?'Already have an account? Sign in':'New here? Create an account'}</button><p className="field-hint">Payments in this college project are test simulations only. No cards or real charges.</p></div><footer className="form-footer">Campus Event Management System</footer></section></main>
  const common = {user,onNavigate:navigate,onLogout:logout,busy}
  const ids=registrations.map(r=>r.event.id)
  return <div className="signed-workspace"><style>{workspaceStyles}</style><WorkspaceNav user={user} page={page} onNavigate={navigate} onLogout={logout} busy={busy}/><NotificationCenter key={user.id} user={user} onNavigate={navigate}/>{(error||notice||busy)&&<div className="api-feedback" aria-live="polite">{error&&<span role="alert">{error}</span>}{notice&&<span>{notice}</span>}{busy&&<span> Saving or loading...</span>}{error&&<button disabled={busy} onClick={()=>operation(async()=>{setUser(await loadSession());await refresh()}).catch(()=>{})}>Reload saved data</button>}</div>}
    {page==='messages'?<MessagesPage key={user.id} user={user}/>:page==='scanner'&&user.role==='admin'?<EntryScanner events={events}/>:page==='ticket'&&ticketEvent&&user.role==='student'?<EntryTicket eventId={ticketEvent} onBack={()=>navigate('student')}/>:page==='user'?<AccountPage {...common} onUpdate={setUser}/>:page==='admin'&&user.role==='admin'?<AdminPage {...common} events={events} onAdd={add} onRemove={cancelEvent}/>:page==='checkout'&&checkout?<CheckoutPage {...common} event={checkout.event} payment={checkout.payment} onResult={complete}/>:page==='events'?<EventPage {...common} events={events} registeredIds={ids} onRegister={register}/>:user.role==='admin'?<AdminPage {...common} events={events} onAdd={add} onRemove={cancelEvent}/>:<StudentPage {...common} events={events} registeredEvents={registrations.map(r=>r.event)} registeredIds={ids} onTicket={eventId=>{setTicketEvent(eventId);navigate('ticket')}} onCancel={cancel}/>}</div>
}
