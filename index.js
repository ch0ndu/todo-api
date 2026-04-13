const express = require('express')
const app = express()
const Database = require('better-sqlite3')
const format = require('date-fns/format')
const isMatch = require('date-fns/isMatch')

app.use(express.json())

// ✅ Use /tmp for Render (important)
const db = new Database('/tmp/todoApplication.db')

// ✅ Create table if not exists (important for Render)
db.exec(`
  CREATE TABLE IF NOT EXISTS todo (
    id INTEGER PRIMARY KEY,
    todo TEXT,
    category TEXT,
    priority TEXT,
    status TEXT,
    due_date TEXT
  )
`)

// ✅ Use Render PORT
const PORT = process.env.PORT || 3000

app.listen(PORT, () => {
  console.log(`Server running on ${PORT}`)
})

// Utility function
const outputResult = dbObject => ({
  id: dbObject.id,
  todo: dbObject.todo,
  category: dbObject.category,
  priority: dbObject.priority,
  status: dbObject.status,
  dueDate: dbObject.due_date,
})

// ------------------ GET TODOS ------------------
app.get('/todos/', (request, response) => {
  const { search_q = '', priority, status, category } = request.query

  try {
    let query = `SELECT * FROM todo WHERE 1=1`
    const params = []

    if (search_q) {
      query += ` AND todo LIKE ?`
      params.push(`%${search_q}%`)
    }
    if (priority) {
      query += ` AND priority = ?`
      params.push(priority)
    }
    if (status) {
      query += ` AND status = ?`
      params.push(status)
    }
    if (category) {
      query += ` AND category = ?`
      params.push(category)
    }

    const data = db.prepare(query).all(...params)
    response.send(data.map(outputResult))
  } catch (error) {
    response.status(500).send('Internal Server Error')
  }
})

// ------------------ GET TODO BY ID ------------------
app.get('/todos/:todoId/', (request, response) => {
  const { todoId } = request.params

  try {
    const result = db
      .prepare(`SELECT * FROM todo WHERE id = ?`)
      .get(todoId)

    if (!result) {
      return response.status(404).send('Todo Not Found')
    }

    response.send(outputResult(result))
  } catch {
    response.status(500).send('Internal Server Error')
  }
})

// ------------------ GET AGENDA ------------------
app.get('/agenda/', (request, response) => {
  const { date } = request.query

  if (!isMatch(date, 'yyyy-MM-dd')) {
    return response.status(400).send('Invalid Due Date')
  }

  const formattedDate = format(new Date(date), 'yyyy-MM-dd')

  const result = db
    .prepare(`SELECT * FROM todo WHERE due_date = ?`)
    .all(formattedDate)

  response.send(result.map(outputResult))
})

// ------------------ CREATE TODO ------------------
app.post('/todos/', (request, response) => {
  const { id, todo, priority, status, category, dueDate } = request.body

  if (!isMatch(dueDate, 'yyyy-MM-dd')) {
    return response.status(400).send('Invalid Due Date')
  }

  const formattedDueDate = format(new Date(dueDate), 'yyyy-MM-dd')

  db.prepare(
    `INSERT INTO todo (id, todo, category, priority, status, due_date)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(id, todo, category, priority, status, formattedDueDate)

  response.send('Todo Successfully Added')
})

// ------------------ UPDATE TODO ------------------
app.put('/todos/:todoId/', (request, response) => {
  const { todoId } = request.params
  const { todo, status, priority, category, dueDate } = request.body

  const previousTodo = db
    .prepare(`SELECT * FROM todo WHERE id = ?`)
    .get(todoId)

  if (!previousTodo) {
    return response.status(404).send('Todo Not Found')
  }

  const updatedTodo = todo ?? previousTodo.todo
  const updatedStatus = status ?? previousTodo.status
  const updatedPriority = priority ?? previousTodo.priority
  const updatedCategory = category ?? previousTodo.category
  const updatedDueDate = dueDate
    ? format(new Date(dueDate), 'yyyy-MM-dd')
    : previousTodo.due_date

  db.prepare(
    `UPDATE todo
     SET todo = ?, status = ?, priority = ?, category = ?, due_date = ?
     WHERE id = ?`
  ).run(
    updatedTodo,
    updatedStatus,
    updatedPriority,
    updatedCategory,
    updatedDueDate,
    todoId
  )

  response.send('Todo Updated')
})

// ------------------ DELETE TODO ------------------
app.delete('/todos/:todoId/', (request, response) => {
  const { todoId } = request.params

  db.prepare(`DELETE FROM todo WHERE id = ?`).run(todoId)

  response.send('Todo Deleted')
})

// ------------------ ROOT ------------------
app.get('/', (request, response) => {
  response.send('Todo API is running!')
})

module.exports = app