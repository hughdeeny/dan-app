import { useEffect, useMemo, useState } from 'react'
import './App.css'

const STORAGE_KEY = 'dan-tasks'

function loadTasks() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function formatToday() {
  return new Intl.DateTimeFormat(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  }).format(new Date())
}

function App() {
  const [tasks, setTasks] = useState(loadTasks)
  const [draft, setDraft] = useState('')

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks))
  }, [tasks])

  const remaining = useMemo(
    () => tasks.filter((task) => !task.done).length,
    [tasks],
  )

  function addTask(event) {
    event.preventDefault()
    const title = draft.trim()
    if (!title) return

    setTasks((current) => [
      { id: crypto.randomUUID(), title, done: false },
      ...current,
    ])
    setDraft('')
  }

  function toggleTask(id) {
    setTasks((current) =>
      current.map((task) =>
        task.id === id ? { ...task, done: !task.done } : task,
      ),
    )
  }

  function removeTask(id) {
    setTasks((current) => current.filter((task) => task.id !== id))
  }

  function clearDone() {
    setTasks((current) => current.filter((task) => !task.done))
  }

  return (
    <div className="app">
      <main className="shell">
        <header className="masthead">
          <h1 className="wordmark">Dan</h1>
          <p className="date">{formatToday()}</p>
        </header>

        <p className="lede">
          A small React app for capturing what needs doing. Tasks stay in this
          browser until you clear them.
        </p>

        <form className="composer" onSubmit={addTask}>
          <input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Add a task"
            aria-label="New task"
          />
          <button type="submit">Add</button>
        </form>

        <div className="toolbar">
          <p className="count">
            {tasks.length === 0
              ? 'Nothing here yet'
              : `${remaining} open · ${tasks.length} total`}
          </p>
          {tasks.some((task) => task.done) ? (
            <button type="button" className="clear-done" onClick={clearDone}>
              Clear done
            </button>
          ) : null}
        </div>

        {tasks.length === 0 ? (
          <p className="empty">Add the first thing on your list.</p>
        ) : (
          <ul className="list">
            {tasks.map((task) => (
              <li key={task.id} className={task.done ? 'item done' : 'item'}>
                <label>
                  <input
                    type="checkbox"
                    checked={task.done}
                    onChange={() => toggleTask(task.id)}
                  />
                  <span className="title">{task.title}</span>
                </label>
                <button
                  type="button"
                  className="remove"
                  onClick={() => removeTask(task.id)}
                  aria-label={`Remove ${task.title}`}
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}

        <p className="foot">React + Vite · edit src/App.jsx to keep going</p>
      </main>
    </div>
  )
}

export default App
