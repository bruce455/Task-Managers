// ----------------------------------   DEPENDENCIES  ----------------------------------------------
const express = require('express');
const app = express();
const handlebars = require('express-handlebars');
const path = require('path');
const pgp = require('pg-promise')();
const bodyParser = require('body-parser');
const session = require('express-session');
const bcrypt = require('bcryptjs'); //  To hash passwords
const flash = require('connect-flash');  

// -------------------------------------  APP CONFIG   ----------------------------------------------

// create `ExpressHandlebars` instance and configure the layouts and partials dir.
const hbs = handlebars.create({
  extname: 'hbs',
  layoutsDir: __dirname + '/views/layouts',
  partialsDir: __dirname + '/views/partials',
});

// Register `hbs` as our view engine using its bound `engine()` function.
app.engine('hbs', hbs.engine);
app.set('view engine', 'hbs');
app.set('views', path.join(__dirname, 'views'));
app.use(bodyParser.json());
// set Session
app.use(
  session({
    secret: process.env.SESSION_SECRET,
    saveUninitialized: true,
    resave: true,
  })
);
app.use(flash()); 
app.use(
  bodyParser.urlencoded({
    extended: true,
  })
);

app.use(express.static(path.join(__dirname, 'resources')));


// -------------------------------------  DB CONFIG AND CONNECT   ---------------------------------------
const dbConfig = {
  host: process.env.HOST,
  port: 5432,
  database: process.env.POSTGRES_DB,
  user: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
};
const db = pgp(dbConfig);

// db test
db.connect()
  .then(obj => {
    // Can check the server version here (pg-promise v10.1.0+):
    console.log('Database connection successful');
    obj.done(); // success, release the connection;
  })
  .catch(error => {
    console.log('ERROR', error.message || error);
  });
// -------------------------------------  MIDDLEWARE   ----------------------------------------------
  // Insert this middleware before the routes that require authentication,
  // to make sure the user is authenticated. If they are not redirect them to /login.
  // Don't do this for /login and /register.
  const auth = (req, res, next) => {
    if (!req.session.user && req.path !== "/login" && req.path !== "/register") {
      return res.redirect("/login");
    }
    next();
  };
//extra middleware for navbar
app.use((req, res, next) => {
  res.locals.user            = req.session.user || null;
  res.locals.successMessages = req.flash('success');
  res.locals.errorMessages   = req.flash('error');
  next();
});
  app.use(auth);
  // -------------------------------------  ROUTES   ----------------------------------------------
  // catch all route

  app.get('/', (req, res) => {
  if (req.session.user) {
    return res.redirect('/home'); // Redirect logged-in users to home
  }
  res.redirect('/login'); // Otherwise, go to login page
});


  // API ROUTES (SAM)



  app.get('/login', (req, res) => {
    res.render('pages/login.hbs');
  });

  app.post('/login', async (req, res, next) => {
      try {
        const { username, password } = req.body;
    
        // Query for the user by username.
        const user = await db.oneOrNone('SELECT * FROM users WHERE username = $1', [username]);
    
        // If user is not found, redirect to registration.
        if (!user) {
          return res.redirect('/register');
        }
    
        // Compare the entered password with the stored hashed password.
        const match = await bcrypt.compare(password, user.password_hashed);
    
        // If user exists and the password doesn't match, send an error message and render the login page.
        if (!match) {
          return res.render('pages/login', { error: 'Password is incorrect. Please try again.' });
        }
    
        // If password matches, save the user in the session and redirect to /discover.
        const { total_tasks } = await db.one(
          // ::int casts the text count to an integer
          'SELECT COUNT(*)::int AS total_tasks FROM tasks WHERE user_id = $1',
          [user.user_id]
        );
        const { daily_tasks } = await db.one(
          // ::int casts the text count to an integer
          'SELECT COUNT(*)::int AS daily_tasks FROM tasks WHERE user_id = $1 AND priority = 0',
          [user.user_id]
        );
        req.session.taskCount = total_tasks;
        req.session.daily_tasks = daily_tasks;
        req.session.user = user;
        req.flash('success', `Welcome back, ${user.username}! You have ${total_tasks - daily_tasks} Upcoming Tasks.`);
        req.session.save(err => {     
          if (err) {
            return next(err);
          }
          res.redirect('/home');
        });
      } catch (error) {
        next(error);
      }
    });


  app.get('/register', (req, res) => {
    res.render('pages/register.hbs');
  });

  app.post('/register', async (req, res) => {
      const {email, username, password } = req.body;
    
      try {
        // Generate same hash on each run - so we can insert test data into the DB and access
        const salt = bcrypt.genSaltSync(10);
        const hashedPassword = await bcrypt.hashSync(password, salt);
    
        // Insert the username and hashed password into the users table.
        // Changed the query placeholders to $1 and $2 for pg-promise.
        const query = 'INSERT INTO users (username, password_hashed, email,rewards_total) VALUES ($1, $2, $3,0)';
        await db.none(query, [username, hashedPassword, email]);
    
        // On success, redirect to the /login route.
        res.redirect('/login');
      } catch (error) {
        console.error('Error during user registration:', error);
        // If the insert fails, redirect back to the /register page.
        res.redirect('/register');
      }
    });

    

  app.get('/calendar', (req, res) => {
    res.render('pages/calendar.hbs');
  });

  app.get("/home", auth, (req, res) => {
    const userId = req.session.user.user_id;
  
    const dailyTasksQuery = db.any(
      `
        SELECT *
        FROM tasks
        WHERE user_id = $1
          AND priority = 0
          AND NOT EXISTS (
            SELECT 1
            FROM completed
            WHERE completed.user_id = tasks.user_id
              AND completed.title = tasks.title
              AND completed.priority = tasks.priority
          );
      `,
      [userId]
    );
  
    const upcomingTasksQuery = db.any(
      `
        SELECT *
        FROM tasks
        WHERE user_id = $1
          AND DATE(due_date AT TIME ZONE 'UTC') >= CURRENT_DATE
          AND priority > 0;
      `,
      [userId]
    );
  
    const completedCountQuery = db.one(
      `SELECT COUNT(*)::int AS completed_count
       FROM completed
       WHERE user_id = $1;`,
      [userId]
    );
  
    Promise.all([dailyTasksQuery, upcomingTasksQuery, completedCountQuery])
      .then(([daily_tasks, upcoming_tasks, { completed_count }]) => {
        const formatter = new Intl.DateTimeFormat("en-US", {
          year: "numeric",
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
          hour12: true,
        });
  
        upcoming_tasks.forEach((task) => {
          task.due_date = formatter.format(new Date(task.due_date));
        });
  
        res.render("pages/home", {
          daily_tasks,
          upcoming_tasks,
          completedCount: completed_count,
        });
      })
      .catch((err) => {
        console.error("Error fetching tasks:", err.message);
        res.status(500).send("Error fetching tasks");
      });
  });
  // get current task info for editting
  app.get('/tasks/:id', async (req, res) => {
    const taskId = parseInt(req.params.id, 10);
    console.log('Fetching task with ID:', taskId);
  
    try {
      const result = await db.any('SELECT * FROM tasks WHERE task_id = $1', [taskId]);
      console.log('Query result:', result);
  
      if (result.length === 0) {
        return res.status(404).json({ error: 'Task not found' });
      }
  
      res.json(result[0]);
    } catch (err) {
      console.error('Error fetching task:', err.message, err.stack);
      res.status(500).json({ error: 'Internal server error' });
    }
  });
  
  
  
  // upodate editted task info to db
  app.put('/tasks/:id', async (req, res) => {
    const taskId = req.params.id;
    console.log('Task ID received:', taskId);

    const { title, description, due_date, priority, reward } = req.body;

  
    try {
      
      await db.query(`
        UPDATE tasks
        SET title = $1, description = $2, due_date = $3, priority = $4, rewards = $5
        WHERE task_id = $6
      `, [title, description, due_date, priority, reward, taskId]);
      
  
      res.status(200).json({ message: 'Task updated successfully' });
    } catch (err) {
      console.error('Error updating task:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });
  
  app.post('/add-event', async (req, res) => {
    const userId = req.session.user?.user_id;

    const { event_name, category_name, eventDate, event_description, event_priority, event_reward } = req.body;
    //console.log(req.body);
    //console.log(userId);

    try {
      const result = await db.any(
        `INSERT INTO tasks (title, description, rewards, priority, due_date, user_id)
        VALUES ($1, $2, $3, $4, $5, $6)`,
        [event_name, event_description, event_reward, event_priority, eventDate, userId]
      );
  
      //refresh the page if adding the event was succesful
      res.redirect('/calendar');
    } catch (err) {
      console.log('Error inserting the event.');
      res.status(500).json({ error: err}); //500 error for server-side error
    }
  });



  app.get('/get-events', async (req, res) => {
    const userId = req.session.user?.user_id;
    if (!userId) {
      return res.redirect('/login');
    }
  
    try {
      // get current events excluding completed dailies
      const events = await db.any(
        `SELECT task_id, title, due_date as start FROM tasks WHERE user_id = $1
        AND NOT EXISTS (
          SELECT 1 FROM completed WHERE completed.user_id = tasks.user_id
          AND completed.title = tasks.title
          AND completed.priority = tasks.priority);`,
        [userId]
      );
      
      res.json(events.map(event => ({
        title: event.title,
        start: event.start,
        extendedProps: {
          task_id: event.task_id
        }
      })));

    } catch (err) {
      console.log("Error getting events from db:", err.message, err.stack);
      res.status(500).json({ error: err});
    }
  });
  app.post('/delete-task', (req, res) => {
    const taskId = req.body.task_id; 

    if (!taskId) {
      return res.status(400).send('No task ID found.');
    }
    try{
    db.any('DELETE FROM Tasks WHERE task_id = $1', [taskId])
      .then(() => {
        
        res.redirect('/calendar'); 
      })
      } catch (err) {
        console.log("Error deleting task from db:", err.message, err.stack);
        res.status(500).json({ error: err});
      }
    });

  // Logout --> Login API Route
  app.get('/logout', (req, res) => {
    req.session.destroy(err => {
      if (err) {
        return console.log(err);
      }
      res.redirect('/login');
    });
  });

  // complete task route
  app.put('/tasks/:id/complete', async (req, res) => {
    console.log("HIT");
    const { id } = req.params;
    console.log(`Completing task ID: ${id}`);
  
    try {
      const result = await db.query(
        'SELECT * FROM tasks WHERE task_id = $1',
        [id]
      );
  
      // const { priority, rewards, user_id } = result.rows[0];
      if (!result || result.length === 0) {
        console.log('Task not found.');
        return res.status(404).send('Task not found');
      }
  
      const { title, description, rewards, priority, due_date, user_id } = result[0];

      console.log(`Task info → priority: ${priority}, rewards: ${rewards}, user_id: ${user_id}`);
  
      // insert into completed table
      await db.query(
        `INSERT INTO completed (title, description, rewards, priority, due_date, user_id)
        VALUES ($1, $2, $3, $4, $5, $6)`,
        [title, description, rewards, priority, due_date, user_id]
      );

      // Update user's rewards_total
      const userResult = await db.query(
        'SELECT rewards_total FROM users WHERE user_id = $1',
        [user_id]
      );
      
      let currentTotal = userResult[0]?.rewards_total;
      
      if (currentTotal === null || currentTotal === undefined) {
        console.log('User rewards_total is null. Initializing to 0.');
        await db.query(
          'UPDATE users SET rewards_total = $1 WHERE user_id = $2',
          [0, user_id]
        );
        // currentTotal = 0;
      }
      
      // Increment rewards_total by rewards
      const updateResult = await db.query(
        'UPDATE users SET rewards_total = rewards_total + $1 WHERE user_id = $2',
        [rewards, user_id]
      );
      console.log('Rows affected by rewards update:', updateResult.rowCount);

      const updatedUser = await db.query('SELECT * FROM users WHERE user_id = $1', [user_id]);
      req.session.user.rewards_total = updatedUser[0].rewards_total;
      console.log('Updated user:', updatedUser[0]);

  
      // Delete task if it's not a daily one
      if (priority !== 0) {
        await db.query('DELETE FROM tasks WHERE task_id = $1', [id]);
      }
  
      res.sendStatus(200);
    } catch (err) {
      console.error('Error completing task:', err);
      res.status(500).send('Error completing task');
    }
  });

  app.get('/profile', async (req, res) => {
    console.log(req.session.user);
    const userId = req.session.user?.user_id;
    if (!userId) {
      return res.redirect('/login');
    }
    
    try {
      const users = await db.any(
        'SELECT * FROM users WHERE user_id = $1',
        [userId]
    
      );
      const tasks = await db.any(
        'SELECT * FROM Completed WHERE user_id = $1',
      [userId]
    );
  
      console.log(users)
      res.render('pages/profile', { topUsers: users, tasks:tasks }); 
    } catch (err) {
      console.error("Error fetching top users from db:", err.message, err.stack);
      res.status(500).json({ error: err.message });
    }
  });

  // leaderboard API route 
  app.get('/leaderboard', async (req, res) => {
  
    try {
      const users = await db.any(
        'SELECT username, rewards_total FROM users ORDER BY rewards_total DESC LIMIT 5'
      );
      res.render('pages/leaderboard', { users });
    } catch (err) {
      console.error("Error fetching top users from db:", err.message, err.stack);
      res.status(500).json({ error: err.message });
    }
  });



  // -------------------------------------  START THE SERVER   ----------------------------------------------

app.listen(3000);
console.log('Server is listening on port 3000');
