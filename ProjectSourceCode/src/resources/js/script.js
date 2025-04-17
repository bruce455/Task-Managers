async function openEditModal(taskId) {
    
    try {
      // Fetch task data from your backend
      const response = await fetch(`/tasks/${taskId}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch task ${taskId}`);
      }
  
      const task = await response.json();
  
      // Populate modal fields
      document.getElementById('edit-title').value = task.title;
      document.getElementById('edit-description').value = task.description;
      // document.getElementById('edit-due-date').value = task.due_date?.split('T')[0];
      if (task.due_date) {
        const date = new Date(task.due_date);
        const local = date.getFullYear() + '-' +
                      String(date.getMonth() + 1).padStart(2, '0') + '-' +
                      String(date.getDate()).padStart(2, '0') + 'T' +
                      String(date.getHours()).padStart(2, '0') + ':' +
                      String(date.getMinutes()).padStart(2, '0');
        document.getElementById('edit-due-date').value = local;
      }
      
      // document.getElementById('edit-priority').value = task.priority;
      const priorityInput = document.getElementById('edit-priority');
      if (priorityInput) priorityInput.value = String(task.priority ?? '');

      document.getElementById('edit-reward').value = task.rewards;

      
      // Store ID for saving later (if needed)
      // document.getElementById('edit-task-modal').dataset.taskId = task.id;
      document.getElementById('edit-task-id').value = task.task_id;

  
      // Show the modal
      const modal = new bootstrap.Modal(document.getElementById('edit-task-modal'));
      modal.show();
    } catch (error) {
      console.error('Error opening edit modal:', error);
    }
  }
  

  async function saveTaskChanges(event) {
    event.preventDefault();
  
    const taskId = document.getElementById('edit-task-id').value;
    const priorityValue = document.getElementById('edit-priority').value;

    const updatedTask = {
      title: document.getElementById('edit-title').value,
      description: document.getElementById('edit-description').value,
      due_date: document.getElementById('edit-due-date').value,
      priority: Number(priorityValue), // ← ensure it's sent as a number (0–10)
      reward: document.getElementById('edit-reward').value
    };
  
    try {
      const response = await fetch(`/tasks/${taskId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedTask)
      });
  
      if (!response.ok) throw new Error('Failed to update task');
  
      // Optionally update the calendar view or refresh events
      if (typeof calendar !== 'undefined') {
        calendar.refetchEvents();
      }
        
      bootstrap.Modal.getInstance(document.getElementById('edit-task-modal')).hide();

      // Reload page to reflect task changes
      window.location.reload();
    } catch (err) {
      console.error('Error saving task changes:', err);
    }
  }
  
  document.addEventListener('DOMContentLoaded', () => {
    const completeBtn = document.getElementById('complete-task-btn');
    if (completeBtn) {
      completeBtn.addEventListener('click', async () => {
        const taskId = document.getElementById('edit-task-id')?.value;
        if (!taskId) return;
  
        try {
          const response = await fetch(`/tasks/${taskId}/complete`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' }
          });
  
          if (!response.ok) throw new Error('Failed to complete task');
  
          bootstrap.Modal.getInstance(document.getElementById('edit-task-modal')).hide();
          window.location.reload();
        } catch (err) {
          console.error('Error completing task:', err);
        }
      });
    }
  });
  