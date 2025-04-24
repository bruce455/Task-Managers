// ---------------------------------- DEPENDENCIES ----------------------------------
const express    = require('express');
const app        = express();
const handlebars = require('express-handlebars');
const path       = require('path');
const pgp        = require('pg-promise')();
const session    = require('express-session');
const flash      = require('connect-flash');

// ---------------------------------- APP CONFIG ------------------------------------
const hbs = handlebars.create({
  extname    : 'hbs',
  layoutsDir : path.join(__dirname, 'views/layouts'),
  partialsDir: path.join(__dirname, 'views/partials'),
});
app.engine('hbs', hbs.engine);
app.set('view engine', 'hbs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'resources')));

app.use(session({
  secret           : process.env.SESSION_SECRET,
  saveUninitialized: true,
  resave           : true,
}));
app.use(flash());

// -------------------------------- DB CONNECT --------------------------------------
const db = pgp({
  host    : process.env.HOST,
  port    : 5432,
  database: process.env.POSTGRES_DB,
  user    : process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
});
db.connect()
  .then(c => { console.log('Database connected'); c.done(); })
  .catch(e => console.error('DB connection error:', e));

// -------------------------------- MIDDLEWARE ---------------------------------------
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

// ---------------------------------- ROUTES ----------------------------------------

// root → login or home
app.get('/', (req, res) => {
  if (req.session.user) return res.redirect('/home');
  res.redirect('/login');
});

// login / register
app.get('/login', (_, res) => res.render('pages/login'));
app.post('/login', async (req, res, next) => {
  try {
    const { username, password } = req.body;
    const user = await db.oneOrNone('SELECT * FROM users WHERE username=$1', [username]);
    if (!user) return res.redirect('/register');
    const ok = await require('bcryptjs').compare(password, user.password_hashed);
    if (!ok) return res.render('pages/login', { error: 'Password incorrect.' });
    req.session.user = user;
    req.flash('success', `Welcome, ${user.username}!`);
    req.session.save(err => err ? next(err) : res.redirect('/home'));
  } catch (e) { next(e); }
});
app.get('/register', (_, res) => res.render('pages/register'));
app.post('/register', async (req, res) => {
  const { email, username, password } = req.body;
  try {
    const hash = await require('bcryptjs').hash(password, 10);
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

// home page (daily & upcoming tasks)
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

    res.render('pages/home', { daily_tasks: daily, upcoming_tasks: upcoming });
  } catch (e) {
    console.error('Home load error:', e);
    res.status(500).send('Error loading home');
  }
});

// calendar page
app.get('/calendar', (_, res) => res.render('pages/calendar'));

// fetch all events (for calendar)
app.get('/get-events', async (req, res) => {
  const uid = req.session.user.user_id;
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
        )`, [uid]);
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
    res.status(500).json({ error: 'Internal error' });
  }
});

// create new event → JSON API (no redirects)
app.post('/add-event', async (req, res) => {
  const uid = req.session.user.user_id;
  const { title, description, priority, reward, due_date } = req.body;
  try {
    await db.none(`
      INSERT INTO tasks (title,description,rewards,priority,due_date,user_id)
      VALUES($1,$2,$3,$4,$5,$6)`,
      [title, description, reward, priority, due_date, uid]
    );
    res.status(201).json({ success: true });
  } catch (e) {
    console.error('add-event error:', e);
    res.status(500).json({ error: 'Insert failed' });
  }
});

// fetch single task for editing
app.get('/tasks/:id', async (req, res) => {
  const id = +req.params.id;
  try {
    const task = await db.oneOrNone('SELECT * FROM tasks WHERE task_id=$1', [id]);
    if (!task) return res.status(404).json({ error: 'Not found' });
    task.reward = task.rewards; // expose as `.reward`
    res.json(task);
  } catch (e) {
    console.error('fetch task error:', e);
    res.status(500).json({ error: 'Internal error' });
  }
});

// update existing event → JSON API
app.put('/tasks/:id', async (req, res) => {
  const id = +req.params.id;
  const { title, description, priority, reward, due_date } = req.body;
  try {
    await db.none(`
      UPDATE tasks
      SET title=$1, description=$2, due_date=$3, priority=$4, rewards=$5
      WHERE task_id=$6`,
      [title, description, due_date, priority, reward, id]
    );
    res.sendStatus(200);
  } catch (e) {
    console.error('update task error:', e);
    res.status(500).json({ error: 'Internal error' });
  }
});

// ... (your delete, complete, profile, leaderboard, logout routes)

app.listen(3000, () => console.log('Server listening on 3000'));
