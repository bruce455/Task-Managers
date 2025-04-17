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
  host: 'db',
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
        req.session.taskCount = total_tasks;
        req.session.user = user;
        req.flash('success', `Welcome back, ${user.username}! You have ${total_tasks} tasks remaining.`);
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
        const query = 'INSERT INTO users (username, password_hashed, email) VALUES ($1, $2, $3)';
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
    console.log(req.session.user);
  
    // Get from environment variable TZ, but handle if TZ is not set
    // If TZ is not set, use UTC as default - should really get it from the browser!
    const time_zone = process.env.TZ || 'US/Mountain';

    
    // Priority 0 is suppose to mean daily's -> But there is no way to set it in the modal -> instead will insert into the init data.
    var dailySqlQuery = `SELECT * FROM tasks WHERE tasks.user_id = $1 AND tasks.priority = 0;`;
    const dailyTasksQuery = db.any(dailySqlQuery, [
      req.session.user.user_id,
    ]);
    const upcomingTasksQuery = db.any(
      "SELECT * FROM tasks WHERE tasks.user_id = $1 AND DATE(tasks.due_date AT TIME ZONE 'UTC') > CURRENT_DATE AND tasks.priority > 0;",
      [req.session.user.user_id]
    );
  
    // Execute both queries concurrently
    Promise.all([dailyTasksQuery, upcomingTasksQuery])
      .then(([daily_tasks, upcoming_tasks]) => {
        //console.log("Daily Tasks:", daily_tasks);
        //console.log("Upcoming Tasks:", upcoming_tasks);
        
        // Clean up the date format
        const formatter = new Intl.DateTimeFormat('en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          hour12: true,           
        });

        
        upcoming_tasks.forEach(task => {
          task.due_date = formatter.format(new Date(task.due_date));
        });
        

        // Render the home page with both results
        res.render("pages/home", { daily_tasks, upcoming_tasks});
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
      const events = await db.any(
        'SELECT task_id, title, due_date as start FROM tasks WHERE user_id = $1',
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

  // Logout --> Login API Route
  app.get('/logout', (req, res) => {
    req.session.destroy(err => {
      if (err) {
        return console.log(err);
      }
      res.redirect('/login');
    });
  });

  // -------------------------------------  START THE SERVER   ----------------------------------------------

app.listen(3000);
console.log('Server is listening on port 3000');