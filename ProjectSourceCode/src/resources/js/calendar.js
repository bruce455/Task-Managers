// Update UTC time every second
function updateDateTime() {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, '0');
  const day = String(now.getUTCDate()).padStart(2, '0');
  const hours = String(now.getUTCHours()).padStart(2, '0');
  const minutes = String(now.getUTCMinutes()).padStart(2, '0');
  const seconds = String(now.getUTCSeconds()).padStart(2, '0');
  
  const formattedDate = `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
  document.querySelector('.current-datetime').textContent = 
      `Current Date and Time (UTC - YYYY-MM-DD HH:MM:SS formatted): ${formattedDate}`;
}

// Initial call and set interval
updateDateTime();
setInterval(updateDateTime, 1000);

// Calendar functionality
let currentDate = new Date();
let events = [];

function updateCalendarHeader() {
  const months = [
      "January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December"
  ];
  
  document.getElementById('currentMonth').textContent = months[currentDate.getMonth()];
  document.getElementById('currentYear').textContent = currentDate.getFullYear();
}

function formatDateNumber(number) {
  return number < 10 ? '0' + number : number;
}

function renderEvents(dayElement, date) {
  const dayEvents = events.filter(event => {
      const eventDate = new Date(event.start);
      return eventDate.getDate() === date.getDate() &&
             eventDate.getMonth() === date.getMonth() &&
             eventDate.getFullYear() === date.getFullYear();
  });

  dayEvents.forEach(event => {
      const eventDiv = document.createElement('div');
      eventDiv.className = 'task';
      const eventTime = new Date(event.start);
      const formattedTime = `${formatDateNumber(eventTime.getHours())}:${formatDateNumber(eventTime.getMinutes())}`;
      eventDiv.textContent = `${formattedTime} - ${event.title}`;
      dayElement.appendChild(eventDiv);
  });
}

function renderCalendar() {
  const daysContainer = document.getElementById('calendar-days');
  daysContainer.innerHTML = ''; // Clear existing days

  const firstDay = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
  const lastDay = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
  
  // Get the day of week for the first day (0 = Sunday, 1 = Monday, ..., 6 = Saturday)
  let firstDayIndex = firstDay.getDay();
  // Convert to Monday-based index (0 = Monday, ..., 6 = Sunday)
  firstDayIndex = firstDayIndex === 0 ? 6 : firstDayIndex - 1;

  // Add empty days for the start of the month
  for (let i = 0; i < firstDayIndex; i++) {
      const emptyDay = document.createElement('div');
      emptyDay.className = 'day day--disabled';
      daysContainer.appendChild(emptyDay);
  }

  // Add the days of the month
  for (let day = 1; day <= lastDay.getDate(); day++) {
      const dayElement = document.createElement('div');
      dayElement.className = 'day';
      const dayNumber = document.createElement('span');
      dayNumber.textContent = day;
      dayElement.appendChild(dayNumber);
      
      // Create a date object for this day
      const currentDayDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
      renderEvents(dayElement, currentDayDate);
      
      daysContainer.appendChild(dayElement);
  }
}

// Event form handling
const eventForm = document.getElementById('eventForm');
const addEventBtn = document.getElementById('addEventBtn');
const cancelEventBtn = document.getElementById('cancelEventBtn');

// Initially hide the form
eventForm.style.display = 'none';

addEventBtn.addEventListener('click', () => {
  // Set the default date and time to today
  const now = new Date();
  const year = now.getFullYear();
  const month = formatDateNumber(now.getMonth() + 1);
  const day = formatDateNumber(now.getDate());
  const hours = formatDateNumber(now.getHours());
  const minutes = formatDateNumber(now.getMinutes());
  
  const defaultDateTime = `${year}-${month}-${day}T${hours}:${minutes}`;
  document.getElementById('eventStart').value = defaultDateTime;
  document.getElementById('eventEnd').value = defaultDateTime;
  
  eventForm.style.display = 'block';
});

cancelEventBtn.addEventListener('click', () => {
  eventForm.style.display = 'none';
  eventForm.reset();
});

eventForm.addEventListener('submit', (e) => {
  e.preventDefault();
  
  const newEvent = {
      title: document.getElementById('eventTitle').value,
      start: document.getElementById('eventStart').value,
      end: document.getElementById('eventEnd').value
  };

  events.push(newEvent);
  eventForm.style.display = 'none';
  eventForm.reset();
  renderCalendar(); // Re-render calendar to show new event
});

// Event listeners for month navigation
document.getElementById('prevMonth').addEventListener('click', () => {
  currentDate.setMonth(currentDate.getMonth() - 1);
  updateCalendarHeader();
  renderCalendar();
});

document.getElementById('nextMonth').addEventListener('click', () => {
  currentDate.setMonth(currentDate.getMonth() + 1);
  updateCalendarHeader();
  renderCalendar();
});

// Initialize calendar
updateCalendarHeader();
renderCalendar();