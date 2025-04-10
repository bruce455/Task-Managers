// ----------------------------------   DEPENDENCIES  ----------------------------------------------
const express = require('express');
const app = express();
const handlebars = require('express-handlebars');
const path = require('path');
const pgp = require('pg-promise')();
const bodyParser = require('body-parser');
const session = require('express-session');
const bcrypt = require('bcryptjs'); //  To hash passwords

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
app.use(
  bodyParser.urlencoded({
    extended: true,
  })
);

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
  
  app.use(auth);
  // -------------------------------------  ROUTES   ----------------------------------------------
  // catch all route

  app.get('/', (req, res) => {
  if (req.session.user) {
    return res.redirect('/home'); // Redirect logged-in users to discover
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
        req.session.user = user;
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
        // Hash the password with a salt round of 10.
        const hashedPassword = await bcrypt.hash(password, 10);
    
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
  
    // Get from envoronment variable TZ, but handle if TZ is not set
    // If TZ is not set, use UTC as default
    const time_zone = process.env.TZ || 'US/Mountain';

    var dailySqlQuery = `SELECT * FROM tasks WHERE tasks.user_id = $1 AND DATE(tasks.due_date AT TIME ZONE 'UTC' AT TIME ZONE '${time_zone}') = DATE(NOW() AT TIME ZONE '${time_zone}');`;
    const dailyTasksQuery = db.any(dailySqlQuery, [
      req.session.user.user_id,
    ]);
    const upcomingTasksQuery = db.any(
      "SELECT * FROM tasks WHERE tasks.user_id = $1 AND DATE(tasks.due_date AT TIME ZONE 'UTC') > CURRENT_DATE;",
      [req.session.user.user_id]
    );
  
    // Execute both queries concurrently
    Promise.all([dailyTasksQuery, upcomingTasksQuery])
      .then(([daily_tasks, upcoming_tasks]) => {
        console.log("Daily Tasks:", daily_tasks);
        console.log("Upcoming Tasks:", upcoming_tasks);
  
        // Render the home page with both results
        res.render("pages/home", { daily_tasks, upcoming_tasks });
      })
      .catch((err) => {
        console.error("Error fetching tasks:", err.message);
        // res.render("pages/courses", {
        //   tasks: [],
        //   error: true,
        //   message: err.message, // TODO Error handle template.
        // });
      });
  });

  // Query 1: db.any("SELECT * FROM tasks WHERE tasks.user_id = $1;", [req.session.user.user_id])


  // -------------------------------------  START THE SERVER   ----------------------------------------------

app.listen(3000);
console.log('Server is listening on port 3000');