import {useEffect,useRef,useState} from 'react'
import {api} from './api.js'
const stamp=value=>new Date(value).toLocaleString('en-IN')
export default function MessagesPage({user}) {
 const [threads,setThreads]=useState([]),[selected,setSelected]=useState(user.role==='student'?user.id:''),[messages,setMessages]=useState([]),[drafts,setDrafts]=useState({}),[loading,setLoading]=useState(false),[sending,setSending]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState(''),[older,setOlder]=useState(null)
 const request=useRef(0),retry=useRef(null),active=useRef(selected)
 active.current=selected
 const draft=drafts[selected]||''
 async function list(){const d=await api('/messages');setThreads(d.threads)}
 async function load(id,before){
   const version=++request.current;setLoading(true);setError('')
   try {const d=await api('/messages/'+id+(before?'?before='+before:''));if(version!==request.current||active.current!==id)return
    setMessages(prev=>before?[...d.messages,...prev]:d.messages);setOlder(d.nextBefore)
    const ids=d.messages.filter(m=>m.senderRole!==user.role&&!m.readAt).map(m=>m.id)
    if(ids.length)await api('/messages/'+id+'/read',{method:'POST',body:{ids}})
    await list()
   }catch(e){if(version===request.current)setError(e.message)}finally{if(version===request.current)setLoading(false)}
 }
 useEffect(()=>{list().catch(e=>setError(e.message))},[])
 useEffect(()=>{setMessages([]);setOlder(null);setNotice('');if(selected)load(selected);return()=>{request.current++}},[selected])
 async function refresh(){setNotice('');try{await list();if(selected)await load(selected)}catch(e){setError(e.message)}}
 async function send(e){e.preventDefault();if(sending||!draft.trim())return;setSending(true);setError('');setNotice('');const id=selected,body=draft.trim();if(!retry.current||retry.current.body!==body||retry.current.id!==id)retry.current={id,body,clientId:crypto.randomUUID()}
  try {await api('/messages/'+id,{method:'POST',body:{body,clientId:retry.current.clientId}});retry.current=null;setDrafts(prev=>({...prev,[id]:''}));setNotice('Message saved.');await load(id)}catch(e){setError(e.message)}finally{setSending(false)}
 }
 const current=threads.find(t=>t.studentId===selected)
 return <main className="management-content messages-page"><div className="campus-heading"><div><small>STAY IN TOUCH</small><h1>{user.role==='admin'?'Student messages.':'Talk to your campus.'}</h1><p>{user.role==='admin'?'Shared inbox for the campus admin team. Students can see only their own conversation.':'A conversation with the campus admin team. All campus admins can read and reply; other students cannot see it.'}</p></div></div><p className="message-scope">In-app text only. Use Refresh to check for replies. No email or phone alerts; no attachments. Do not send passwords or payment details.</p><button className="campus-primary" disabled={loading||sending} onClick={refresh}>Refresh messages</button>{error&&<p role="alert" className="account-error">{error}</p>}{notice&&<p role="status">{notice}</p>}<div className={'messages-grid '+(user.role==='student'?'student-inbox':'')}>
 {user.role==='admin'&&<section className="campus-panel message-threads" aria-label="Student conversations"><h2>Conversations</h2><p>Latest 100 active student conversations.</p>{!threads.length&&<p>No student messages yet. Students start the conversation from Messages.</p>}{threads.map(t=><button disabled={sending} key={t.studentId} aria-pressed={selected===t.studentId} onClick={()=>setSelected(t.studentId)}><strong>{t.name}</strong><span>{t.unread?t.unread+' unread':'No unread messages'}</span><span>{t.preview}</span></button>)}</section>}
 <section className="campus-panel message-conversation" aria-label="Conversation">{!selected?<><h2>Choose a conversation</h2><p>Select a student to read their messages and reply.</p></>:<><h2>{user.role==='admin'?current?.name||'Student conversation':'Campus admin team'}</h2>{user.role==='admin'&&current&&<p className="message-student-code">Student ID: {current.studentCode}</p>}{older&&<button disabled={loading||sending} onClick={()=>load(selected,older)}>Load older messages</button>}{loading&&<p role="status">Loading saved messages...</p>}<div className="message-history" aria-label="Saved messages">{!loading&&!messages.length&&<p>No messages yet. Write your first message below.</p>}{messages.map(m=><article className={'message-bubble '+(m.senderRole===user.role?'own':'')} key={m.id}><header><strong>{m.senderRole==='admin'?'Admin · ':''}{m.senderName}</strong><time dateTime={m.createdAt}>{stamp(m.createdAt)}</time></header><p>{m.body}</p></article>)}</div><form onSubmit={send}><label htmlFor="message-body">{user.role==='admin'?'Reply to student':'Message to admin team'}</label><textarea id="message-body" value={draft} onChange={e=>setDrafts(prev=>({...prev,[selected]:e.target.value}))} required maxLength={2000} rows={4} disabled={sending} placeholder="Write your message..."/><p>{draft.length} / 2,000 characters. Messages are saved after you press Send.</p><button className="campus-primary" disabled={sending||loading||!draft.trim()}>{sending?'Saving message...':'Send message'}</button></form></>}
 </section></div></main>
}
