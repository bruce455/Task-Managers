// ---------------------------------- DEPENDENCIES ----------------------------------
const express       = require('express');
const app           = express();
const handlebars    = require('express-handlebars');
const path          = require('path');
const pgp           = require('pg-promise')();
const bodyParser    = require('body-parser');
const session       = require('express-session');
const bcrypt        = require('bcryptjs');
const flash         = require('connect-flash');

// ----------------------------------- APP CONFIG -----------------------------------
const hbs = handlebars.create({
  extname     : 'hbs',
  layoutsDir  : __dirname + '/views/layouts',
  partialsDir : __dirname + '/views/partials'
});
app.engine('hbs', hbs.engine);
app.set('view engine', 'hbs');
app.set('views', path.join(__dirname, 'views'));

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'resources')));
app.use(session({
  secret           : process.env.SESSION_SECRET,
  saveUninitialized: true,
  resave           : true,
}));
app.use(flash());

// ------------------------------- DB CONFIG & CONNECT -------------------------------
const db = pgp({
  host    : process.env.HOST,
  port    : 5432,
  database: process.env.POSTGRES_DB,
  user    : process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
});
db.connect()
  .then(obj => { console.log('Database connected'); obj.done(); })
  .catch(err => console.error('DB connection error:', err));

// ---------------------------------- MIDDLEWARE ------------------------------------
const auth = (req, res, next) => {
  if (!req.session.user && !['/login','/register'].includes(req.path)) {
    return res.redirect('/login');
  }
  next();
};
app.use((req, res, next) => {
  res.locals.user            = req.session.user || null;
  res.locals.successMessages = req.flash('success');
  res.locals.errorMessages   = req.flash('error');
  next();
});
app.use(auth);

// ------------------------------------ ROUTES --------------------------------------

// Root
app.get('/', (req, res) => {
  if (req.session.user) return res.redirect('/home');
  res.redirect('/login');
});

// Login / Register
app.get('/login',    (_,res) => res.render('pages/login'));
app.post('/login',   async (req,res,next) => {
  try {
    const { username, password } = req.body;
    const user = await db.oneOrNone('SELECT * FROM users WHERE username=$1',[username]);
    if (!user) return res.redirect('/register');
    if (!await bcrypt.compare(password, user.password_hashed)) {
      return res.render('pages/login',{ error: 'Password incorrect.' });
    }
    const { total_tasks } = await db.one(
      'SELECT COUNT(*)::int AS total_tasks FROM tasks WHERE user_id=$1',[user.user_id]);
    req.session.user = user;
    req.flash('success', `Welcome, ${user.username}! You have ${total_tasks} tasks.`);
    req.session.save(err => err ? next(err) : res.redirect('/home'));
  } catch (e) { next(e); }
});

app.get('/register', (_,res) => res.render('pages/register'));
app.post('/register', async (req,res) => {
  const { email, username, password } = req.body;
  try {
    const hash = await bcrypt.hash(password, 10);
    await db.none(
      'INSERT INTO users (username,password_hashed,email,rewards_total) VALUES($1,$2,$3,0)',
      [username, hash, email]
    );
    res.redirect('/login');
  } catch (e) {
    console.error('Register error:', e);
    res.redirect('/register');
  }
});

// Calendar page
app.get('/calendar', (_, res) => {
  res.render('pages/calendar');
});

// Home page
app.get('/home', async (req, res) => {
  const uid = req.session.user.user_id;
  try {
    const daily = await db.any(`
      SELECT * FROM tasks
      WHERE user_id=$1 AND priority=0
        AND NOT EXISTS (
          SELECT 1 FROM completed
          WHERE completed.user_id=tasks.user_id
            AND completed.title=tasks.title
            AND completed.priority=tasks.priority
        )`, [uid]);
    const upcoming = await db.any(`
      SELECT * FROM tasks
      WHERE user_id=$1
        AND DATE(due_date AT TIME ZONE 'UTC')>=CURRENT_DATE
        AND priority>0`, [uid]);
    const fmt = new Intl.DateTimeFormat('en-US',{
      year:'numeric',month:'short',day:'numeric',
      hour:'2-digit',minute:'2-digit',hour12:true
    });
    upcoming.forEach(t => t.due_date = fmt.format(new Date(t.due_date)));
    res.render('pages/home',{ daily_tasks:daily, upcoming_tasks:upcoming });
  } catch (e) {
    console.error(e);
    res.status(500).send('Error fetching tasks');
  }
});

// Fetch a single task
app.get('/tasks/:id', async (req, res) => {
  try {
    const id = +req.params.id;
    const task = await db.oneOrNone('SELECT * FROM tasks WHERE task_id=$1 LIMIT 1',[ id ]);
    if (!task) return res.status(404).json({ error:'Not found' });
    res.json(task);
  } catch (e) {
    console.error('Fetch task error:', e);
    res.status(500).json({ error:'Internal error' });
  }
});

// Update task
app.put('/tasks/:id', async (req, res) => {
  try {
    const id = +req.params.id;
    const { title, description, due_date, priority, reward } = req.body;
    await db.none(`
      UPDATE tasks
      SET title=$1, description=$2, due_date=$3, priority=$4, rewards=$5
      WHERE task_id=$6`,
      [ title, description, due_date, priority, reward, id ]
    );
    res.sendStatus(200);
  } catch (e) {
    console.error('Update task error:', e);
    res.status(500).json({ error:'Internal error' });
  }
});

// Add new event
app.post('/add-event', async (req, res) => {
  const uid = req.session.user?.user_id;
  if (!uid) return res.redirect('/login');
  const { event_name, event_description, eventDate, event_priority, event_reward } = req.body;
  try {
    await db.none(`
      INSERT INTO tasks (title,description,rewards,priority,due_date,user_id)
      VALUES ($1,$2,$3,$4,$5,$6)`,
      [ event_name, event_description, event_reward, event_priority, eventDate, uid ]
    );
    res.redirect('/calendar');
  } catch (e) {
    console.error('Add-event error:', e);
    res.status(500).send('Insert failed');
  }
});

// Get events for calendar (with priority & reward)
app.get('/get-events', async (req, res) => {
  const uid = req.session.user?.user_id;
  if (!uid) return res.redirect('/login');
  try {
    const rows = await db.any(`
      SELECT
        task_id,
        title,
        description,
        priority,
        rewards AS reward,
        due_date AS start
      FROM tasks
      WHERE user_id=$1
        AND NOT EXISTS (
          SELECT 1 FROM completed
          WHERE completed.user_id=tasks.user_id
            AND completed.title=tasks.title
            AND completed.priority=tasks.priority
        )`, [ uid ]);
    res.json(rows.map(r => ({
      task_id    : r.task_id,
      title      : r.title,
      description: r.description,
      priority   : r.priority,
      reward     : r.reward,
      start      : r.start
    })));
  } catch (e) {
    console.error('get-events error:', e);
    res.status(500).json({ error:'Internal error' });
  }
});

// Delete task
app.post('/delete-task', async (req, res) => {
  const { task_id } = req.body;
  if (!task_id) return res.status(400).send('No task ID');
  try {
    await db.none('DELETE FROM tasks WHERE task_id=$1',[ task_id ]);
    res.redirect('/calendar');
  } catch (e) {
    console.error('Delete task error:', e);
    res.status(500).send('Delete failed');
  }
});

// [ … your /tasks/:id/complete, /profile, /leaderboard, /logout routes remain unchanged … ]

// -------------------------------- START SERVER --------------------------------
app.listen(3000, () => console.log('Server listening on port 3000'));
