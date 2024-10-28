// Initialize lessons array
let lessons = [];

// Function to save lessons to localStorage as backup
function saveToLocalStorage() {
    localStorage.setItem('lessons', JSON.stringify(lessons));
}

// Function to load lessons from localStorage
function loadFromLocalStorage() {
    const stored = localStorage.getItem('lessons');
    if (stored) {
        lessons = JSON.parse(stored);
        renderLessons();
    }
}

// Function to create a lesson card
function createLessonCard(lesson) {
    return `
        <div class="card ${lesson.category}">
            <button class="delete-btn" onclick="deleteLesson(${lesson.id})">×</button>
            <h3>${lesson.title}</h3>
            <span class="tag ${lesson.impact}">${lesson.impact} Impact</span>
            <p><strong>Description:</strong> ${lesson.description}</p>
            <p><strong>Recommendations:</strong> ${lesson.recommendations}</p>
            <p><strong>Owner:</strong> ${lesson.owner}</p>
        </div>
    `;
}

// Function to render all lessons
function renderLessons() {
    const container = document.getElementById('cardsContainer');
    container.innerHTML = lessons.map(lesson => createLessonCard(lesson)).join('');
}

// Function to add a new lesson
document.getElementById('lessonsForm').addEventListener('submit', function(e) {
    e.preventDefault();
    
    const newLesson = {
        id: Date.now(),
        title: document.getElementById('title').value,
        category: document.getElementById('category').value,
        description: document.getElementById('description').value,
        impact: document.getElementById('impact').value,
        recommendations: document.getElementById('recommendations').value,
        owner: document.getElementById('owner').value
    };

    lessons.push(newLesson);
    saveToLocalStorage();
    renderLessons();
    this.reset();
});

// Function to delete a lesson
function deleteLesson(id) {
    if (confirm('Are you sure you want to delete this lesson?')) {
        lessons = lessons.filter(lesson => lesson.id !== id);
        saveToLocalStorage();
        renderLessons();
    }
}

// Function to clear all lessons
function clearAllLessons() {
    if (confirm('Are you sure you want to clear all lessons? This cannot be undone.')) {
        lessons = [];
        saveToLocalStorage();
        renderLessons();
    }
}

// Function to export lessons to CSV
function exportToCSV() {
    const csvContent = [
        ['Title', 'Category', 'Description', 'Impact', 'Recommendations', 'Owner'],
        ...lessons.map(lesson => [
            lesson.title,
            lesson.category,
            lesson.description,
            lesson.impact,
            lesson.recommendations,
            lesson.owner
        ])
    ].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'lessons_learned.csv';
    link.click();
}

// Load existing lessons when page loads
loadFromLocalStorage();
