import { Fragment, useEffect, useState } from "react"
import { HELP_EVENT } from "../../utils/help"
import TOPICS from "./topics.json"
import "./Help.css"

// Help: the game's topics (topics.json, from 98ish Help's format) in a 98 window. Opens on
// openHelp() (utils/help.js) or F1; a topic id picks the page, anything else the first one.
// Blocks: a string (a paragraph), { h }, { list }, { steps, title }, { tip }, { note },
// { phone, computer }, { keys: [[key, what]], title }, { img, alt }; **bold** inside text.

const topicFor = (target) => TOPICS.find((t) => t.id === target?.topic) || TOPICS[0]

const Text = ({ text }) =>
  String(text)
    .split(/(\*\*[^*]+\*\*)/g)
    .map((part, i) => (part.startsWith("**") && part.endsWith("**") ? <b key={i}>{part.slice(2, -2)}</b> : <Fragment key={i}>{part}</Fragment>))

const Block = ({ block }) => {
  if (typeof block === "string") return <p><Text text={block} /></p>
  if (block.h) return <h3>{block.h}</h3>
  if (block.list) return <ul>{block.list.map((item, i) => <li key={i}><Text text={item} /></li>)}</ul>
  if (block.steps)
    return (
      <>
        {block.title && <p><b>{block.title}</b></p>}
        <ol>{block.steps.map((item, i) => <li key={i}><Text text={item} /></li>)}</ol>
      </>
    )
  if (block.keys)
    return (
      <table className="pkHelpKeys">
        {block.title && <caption>{block.title}</caption>}
        <tbody>
          {block.keys.map(([key, what]) => (
            <tr key={key}>
              <th scope="row">{key}</th>
              <td>{what}</td>
            </tr>
          ))}
        </tbody>
      </table>
    )
  if (block.img) return <img className="pkHelpImg" src={block.img} alt={block.alt || ""} />
  const aside = block.tip || block.note || block.phone || block.computer
  if (aside)
    return (
      <div className="pkHelpAside">
        {block.tip && <p><b>Tip: </b><Text text={block.tip} /></p>}
        {block.note && <p><b>Note: </b><Text text={block.note} /></p>}
        {block.phone && <p><b>On a phone: </b><Text text={block.phone} /></p>}
        {block.computer && <p><Text text={block.computer} /></p>}
      </div>
    )
  return null
}

export default function Help() {
  const [topic, setTopic] = useState(null)
  useEffect(() => {
    const onHelp = (e) => setTopic(topicFor(e.detail))
    const onKey = (e) => {
      if (e.key !== "F1") return
      e.preventDefault()
      setTopic((t) => t || topicFor(null))
    }
    window.addEventListener(HELP_EVENT, onHelp)
    window.addEventListener("keydown", onKey)
    return () => {
      window.removeEventListener(HELP_EVENT, onHelp)
      window.removeEventListener("keydown", onKey)
    }
  }, [])
  useEffect(() => {
    if (!topic) return
    const onKey = (e) => e.key === "Escape" && setTopic(null)
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [topic])
  if (!topic) return null
  return (
    <div className="pkHelpBack" onClick={(e) => e.target === e.currentTarget && setTopic(null)}>
      <div className="window pkHelp" role="dialog" aria-label="Pickleball 98 Help">
        <div className="title-bar">
          <div className="title-bar-text">Pickleball 98 Help</div>
          <div className="title-bar-controls">
            <button type="button" aria-label="Close" onClick={() => setTopic(null)} />
          </div>
        </div>
        <div className="window-body pkHelpBody">
          <nav className="pkHelpTopics" aria-label="Topics">
            {TOPICS.map((t) => (
              <button type="button" key={t.id} className={t.id === topic.id ? "is-on" : ""} aria-current={t.id === topic.id ? "page" : undefined} onClick={() => setTopic(t)}>
                {t.title}
              </button>
            ))}
          </nav>
          <article className="pkHelpPage" key={topic.id}>
            <h2>{topic.title}</h2>
            {topic.summary && <p className="pkHelpSummary">{topic.summary}</p>}
            {topic.body.map((block, i) => (
              <Block key={i} block={block} />
            ))}
          </article>
        </div>
      </div>
    </div>
  )
}
