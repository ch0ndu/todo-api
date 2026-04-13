const express = require('express')
const app = express()
const path = require('path')
const { open } = require('sqlite')
const sqlite3 = require('sqlite3')
const format = require('date-fns/format')
const isMatch = require('date-fns/isMatch')

app.use(express.json())

let database

const dbPath = '/tmp/todoApplication.db'

// Use Render-compatible PORT
const PORT = process.env.PORT || 3000

const initializeServerAndDb = async () => {
  try {
    database = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    })

    app.listen(PORT, () => {
      console.log(`Server Running on ${PORT}`)
    })
  } catch (e) {
    console.error(`DB Error: ${e.message}`)
    process.exit(1)
  }
}

initializeServerAndDb()

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
app.get('/todos/', async (request, response) => {
  const { search_q = '', priority, status, category } = request.query

  try {
    if (priority && !['HIGH', 'MEDIUM', 'LOW'].includes(priority)) {
      return response.status(400).send('Invalid Todo Priority')
    }

    if (status && !['TO DO', 'IN PROGRESS', 'DONE'].includes(status)) {
      return response.status(400).send('Invalid Todo Status')
    }

    if (category && !['WORK', 'HOME', 'LEARNING'].includes(category)) {
      return response.status(400).send('Invalid Todo Category')
    }

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

    const data = await database.all(query, params)
    response.send(data.map(outputResult))
  } catch (error) {
    console.error(error)
    response.status(500).send('Internal Server Error')
  }
})

// ------------------ GET TODO BY ID ------------------
app.get('/todos/:todoId/', async (request, response) => {
  const { todoId } = request.params

  try {
    const result = await database.get(
      `SELECT * FROM todo WHERE id = ?`,
      [todoId]
    )

    if (!result) {
      return response.status(404).send('Todo Not Found')
    }

    response.send(outputResult(result))
  } catch (error) {
    console.error(error)
    response.status(500).send('Internal Server Error')
  }
})

// ------------------ GET AGENDA ------------------
app.get('/agenda/', async (request, response) => {
  const { date } = request.query

  if (!isMatch(date, 'yyyy-MM-dd')) {
    return response.status(400).send('Invalid Due Date')
  }

  try {
    const formattedDate = format(new Date(date), 'yyyy-MM-dd')

    const result = await database.all(
      `SELECT * FROM todo WHERE due_date = ?`,
      [formattedDate]
    )

    response.send(result.map(outputResult))
  } catch (error) {
    console.error(error)
    response.status(500).send('Internal Server Error')
  }
})

// ------------------ CREATE TODO ------------------
app.post('/todos/', async (request, response) => {
  const { id, todo, priority, status, category, dueDate } = request.body

  if (!['HIGH', 'MEDIUM', 'LOW'].includes(priority)) {
    return response.status(400).send('Invalid Todo Priority')
  }

  if (!['TO DO', 'IN PROGRESS', 'DONE'].includes(status)) {
    return response.status(400).send('Invalid Todo Status')
  }

  if (!['WORK', 'HOME', 'LEARNING'].includes(category)) {
    return response.status(400).send('Invalid Todo Category')
  }

  if (!isMatch(dueDate, 'yyyy-MM-dd')) {
    return response.status(400).send('Invalid Due Date')
  }

  try {
    const formattedDueDate = format(new Date(dueDate), 'yyyy-MM-dd')

    await database.run(
      `INSERT INTO todo (id, todo, category, priority, status, due_date)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [id, todo, category, priority, status, formattedDueDate]
    )

    response.send('Todo Successfully Added')
  } catch (error) {
    console.error(error)
    response.status(500).send('Internal Server Error')
  }
})

// ------------------ UPDATE TODO ------------------
app.put('/todos/:todoId/', async (request, response) => {
  const { todoId } = request.params
  const { todo, status, priority, category, dueDate } = request.body

  try {
    const previousTodo = await database.get(
      `SELECT * FROM todo WHERE id = ?`,
      [todoId]
    )

    if (!previousTodo) {
      return response.status(404).send('Todo Not Found')
    }

    const updatedTodo = todo ?? previousTodo.todo
    const updatedStatus = status ?? previousTodo.status
    const updatedPriority = priority ?? previousTodo.priority
    const updatedCategory = category ?? previousTodo.category
    const updatedDueDate = dueDate ?? previousTodo.due_date

    if (status && !['TO DO', 'IN PROGRESS', 'DONE'].includes(status)) {
      return response.status(400).send('Invalid Todo Status')
    }

    if (priority && !['HIGH', 'MEDIUM', 'LOW'].includes(priority)) {
      return response.status(400).send('Invalid Todo Priority')
    }

    if (category && !['WORK', 'HOME', 'LEARNING'].includes(category)) {
      return response.status(400).send('Invalid Todo Category')
    }

    if (dueDate && !isMatch(dueDate, 'yyyy-MM-dd')) {
      return response.status(400).send('Invalid Due Date')
    }

    const formattedDueDate = dueDate
      ? format(new Date(dueDate), 'yyyy-MM-dd')
      : updatedDueDate

    await database.run(
      `UPDATE todo
       SET todo = ?, status = ?, priority = ?, category = ?, due_date = ?
       WHERE id = ?`,
      [
        updatedTodo,
        updatedStatus,
        updatedPriority,
        updatedCategory,
        formattedDueDate,
        todoId,
      ]
    )

    response.send('Todo Updated')
  } catch (error) {
    console.error(error)
    response.status(500).send('Internal Server Error')
  }
})

// ------------------ DELETE TODO ------------------
app.delete('/todos/:todoId/', async (request, response) => {
  const { todoId } = request.params

  try {
    await database.run(`DELETE FROM todo WHERE id = ?`, [todoId])
    response.send('Todo Deleted')
  } catch (error) {
    console.error(error)
    response.status(500).send('Internal Server Error')
  }
})

// ------------------ ROOT ------------------
app.get('/', (request, response) => {
  response.send('Todo API is running! Use /todos/')
})

module.exports = app