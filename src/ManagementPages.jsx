import { useEffect, useState } from 'react'
import { QRCode } from './qr-tools.js'
import './CampusPages.css'
import { api } from './api.js'

const emptyForm = { title: '', category: 'Technology', description: '', startsAt: '', venue: '', host: '', type: 'College', price: '0' }

function Frame({ title, onNavigate, onLogout, user, children }) {
  return <main className="management-page"><header><button onClick={() => onNavigate('student')}>CampusConnect</button><nav aria-label="Account pages">{user.role !== 'admin' && <button onClick={() => onNavigate('student')}>Student</button>}<button onClick={() => onNavigate('user')}>User profile</button><button onClick={() => onNavigate('events')}>Events</button>{user.role==='admin'&&<button onClick={() => onNavigate('admin')}>Manage events</button>}<button onClick={onLogout}>Sign out</button></nav></header><div className="management-content"><p className="management-label">CAMPUS EVENT MANAGEMENT</p><h1>{title}</h1><p className="management-note">{title==='Test checkout.'?'Complete your event registration.':'Events and registrations are saved to your account. All payment flows are test simulations only.'}</p>{children}</div></main>
}

export function AdminPage({ events, onAdd, onRemove, onNavigate, onLogout, user, busy }) {
  const [form, setForm] = useState(emptyForm)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [pendingRemove, setPendingRemove] = useState(null)
  const [rosters, setRosters] = useState({})
  const [rosterBusy, setRosterBusy] = useState({})
  const [rosterErrors, setRosterErrors] = useState({})
  async function loadRoster(id) {
    if(rosterBusy[id]) return
    setRosterBusy(previous=>({...previous,[id]:true}));setRosterErrors(previous=>({...previous,[id]:''}))
    try { const data=await api('/events/'+id+'/registrations');setRosters(previous=>({...previous,[id]:data.registrations})) }
    catch(error) { setRosterErrors(previous=>({...previous,[id]:error.message})) }
    finally { setRosterBusy(previous=>({...previous,[id]:false})) }
  }
  function field(key, value) { setForm(previous => ({ ...previous, [key]: value })) }
  async function submit(event) {
    event.preventDefault()
    const date = new Date(form.startsAt)
    const price = Number(form.price)
    if (!form.title.trim() || !form.venue.trim() || !form.host.trim() || !form.description.trim() || !Number.isFinite(date.getTime()) || date <= new Date() || !Number.isFinite(price) || price < 0 || price > 100000) { setError('Fill in all fields, choose a future date, and enter a test fee from ₹0 to ₹100,000.'); return }
    try {
      await onAdd({ title: form.title.trim(), venue: form.venue.trim(), host: form.host.trim(), description: form.description.trim(), category: form.category, type: form.type, startsAt: date.toISOString(), feePaise: Math.round(price * 100) })
      setForm(emptyForm); setError(''); setMessage('Event saved.')
    } catch (error) { setError(error.message) }
  }
  return <Frame title="Make something happen." onNavigate={onNavigate} onLogout={onLogout} user={user}>
    <div className="management-banner">Admin workspace. New accounts are students; only an approved admin account can manage events.</div>
    <div className="management-grid"><section className="campus-panel"><h2>Add an event</h2><form className="management-form" onSubmit={submit}>
      <label>Event title<input required maxLength={100} value={form.title} onChange={event => field('title', event.target.value)} /></label>
      <div className="management-form-row"><label>Event type<select value={form.type} onChange={event => field('type', event.target.value)}><option>College</option><option>Outside</option></select></label><label>Category<select value={form.category} onChange={event => field('category', event.target.value)}>{['Technology', 'Culture', 'Workshop', 'Sports', 'Other'].map(item => <option key={item}>{item}</option>)}</select></label></div>
      <label>Date and time (this device's timezone)<input required type="datetime-local" value={form.startsAt} onChange={event => field('startsAt', event.target.value)} /></label>
      <label>Venue<input required maxLength={120} value={form.venue} onChange={event => field('venue', event.target.value)} /></label>
      <label>Organizer name<input required maxLength={100} value={form.host} onChange={event => field('host', event.target.value)} /></label>
      <label>Description<textarea required rows={4} maxLength={2000} value={form.description} onChange={event => field('description', event.target.value)} /></label>
      <label>Test fee (INR)<input required type="number" min="0" max="100000" step="0.01" value={form.price} onChange={event => field('price', event.target.value)} /></label><p>₹0 means free. A paid amount only goes through the local test checkout, never a bank.</p>
      {error && <p className="management-error" role="alert">{error}</p>}{message && <p className="campus-notice" role="status">{message}</p>}
      <button type="submit" className="campus-primary" disabled={busy}>{busy ? 'Saving...' : 'Save event'} ↗</button>
    </form></section><section className="campus-panel"><h2>Your event list <small>({events.length})</small></h2>{events.length === 0 ? <div className="campus-empty"><h3>Start with your first event.</h3><p>Add a college or outside event. Then open Events to try its registration flow.</p></div> : <div className="management-event-list">{events.map(event => <article key={event.id}><small>{event.type} · {event.category}</small><h3>{event.title}{event.cancelled ? ' (cancelled)' : ''}</h3><p>{event.day} {event.month} · {event.venue}</p><p>Test fee: ₹{event.price.toFixed(2)}</p><button disabled={rosterBusy[event.id]} onClick={()=>loadRoster(event.id)}>{rosterBusy[event.id] ? 'Loading registrations...' : rosters[event.id] ? 'Refresh registrations' : 'View registrations'}</button>{rosterErrors[event.id] && <p role="alert" className="management-error">{rosterErrors[event.id]}</p>}{rosters[event.id] && <section aria-label={'Registrations for '+event.title} style={{marginTop:12,padding:14,border:'1px solid #d6dbe0',borderRadius:8,background:'#f7f4ed',overflowWrap:'anywhere'}}><h3>Registered students ({rosters[event.id].length})</h3><p>Current saved registrations. Refresh to check for changes.</p>{rosters[event.id].length===0 ? <p>No students registered yet.</p> : <ul style={{listStyle:'none',padding:0,margin:0}}>{rosters[event.id].map(row=><li key={row.id} style={{padding:'14px 0',borderTop:'1px solid #d6dbe0'}}>{row.student ? <><strong>{row.student.name}</strong><p>{row.student.email}</p><p>Student ID: {row.student.studentId}</p></> : <strong>Account no longer available</strong>}<p>Registered: {new Date(row.registeredAt).toLocaleString('en-IN')}</p></li>)}</ul>}<button onClick={()=>setRosters(previous=>{const next={...previous};delete next[event.id];return next})}>Hide registrations</button></section>}{pendingRemove === event.id ? <div className="management-remove"><p>Cancel this event? Saved registrations remain marked with its cancellation.</p><button disabled={busy} onClick={async () => { try { await onRemove(event.id); setPendingRemove(null) } catch(e) { setError(e.message) } }}>Yes, cancel event</button><button onClick={() => setPendingRemove(null)}>Keep event</button></div> : <button disabled={busy || event.cancelled} onClick={() => setPendingRemove(event.id)}>Cancel event</button>}</article>)}</div>}<button className="campus-primary" onClick={() => onNavigate('events')}>Open Events ↗</button></section></div>
  </Frame>
}

function TestPaymentQR({payment}) {
  const [image,setImage]=useState(''),[qrError,setQrError]=useState('')
  useEffect(()=>{let active=true;setImage('');setQrError('');if(payment?.id){const payload=JSON.stringify({purpose:'CAMPUSCONNECT_TEST_PAYMENT_ONLY',reference:payment.id,amountPaise:payment.amountPaise,currency:'INR',realMoney:false});QRCode.toDataURL(payload,{width:300,margin:4,errorCorrectionLevel:'M',color:{dark:'#15365b',light:'#ffffff'}}).then(value=>{if(active)setImage(value)}).catch(()=>{if(active)setQrError('Cannot create the test QR. You can still use the simulator buttons below.')})}return()=>{active=false}},[payment?.id,payment?.amountPaise])
  return <section className="test-payment-qr" aria-label="Test payment QR">{image?<img src={image} width="300" height="300" alt="Test-mode payment QR. Reference only; no money is collected."/>:<p role="status">{qrError||'Creating QR...'}</p>}<details><summary>About this QR</summary><p>This QR contains a test reference, not a bank payment request. Scanning does not collect money or confirm registration. Use the test controls below.</p><p className="test-payment-reference">Reference: {payment.id}</p><p>Your separate entry-ticket QR appears under My registrations after a saved registration.</p></details></section>
}

export function CheckoutPage({ event, payment, onResult, onNavigate, onLogout, user, busy }) {
  const [error, setError] = useState('')
  const result = payment?.status === 'pending' ? '' : payment?.status
  async function finish(outcome) { if(result || busy) return; setError(''); try { await onResult(outcome) } catch(e) {setError(e.message)} }
  return <Frame title="Test checkout." onNavigate={onNavigate} onLogout={onLogout} user={user}><div className="checkout-card campus-panel">{!event || !payment ? <><h2>No event selected.</h2><button onClick={() => onNavigate('events')}>Back to Events</button></> : <><span className="management-label">{event.type} EVENT</span><h2>{event.title}</h2><p>{event.day} {event.month} · {event.time}</p><p>{event.venue}</p><dl className="checkout-total"><dt>Amount</dt><dd>₹{(payment.amountPaise/100).toFixed(2)}</dd></dl><TestPaymentQR payment={payment}/>{error&&<p role="alert" className="management-error">{error}</p>}{!result ? <div className="checkout-actions"><button disabled={busy} className="campus-primary" onClick={() => finish('success')}>Simulate success</button><button disabled={busy} onClick={() => finish('failure')}>Simulate failure</button><button disabled={busy} onClick={() => finish('cancelled')}>Cancel test</button></div> : <div className="checkout-result" role="status"><h3>{result === 'success' ? 'TEST SUCCESS · Registration saved' : result === 'failure' ? 'TEST FAILED · No registration added' : 'TEST CANCELLED · No registration added'}</h3><p>Test mode · Outcome saved.</p><button className="campus-primary" onClick={() => onNavigate(result === 'success' ? 'student' : 'events')}>{result === 'success' ? 'Open Student dashboard' : 'Back to Events'} ↗</button></div>}</>}</div></Frame>
}
