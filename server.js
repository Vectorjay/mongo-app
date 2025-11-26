const express = require('express');
const mongoose = require('mongoose');
const app = express();
const PORT = process.env.PORT || 3000;

// MongoDB connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://admin:password@localhost:27017/mydatabase';

mongoose.connect(MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log('Connected to MongoDB'))
.catch(err => console.error('MongoDB connection error:', err));

// Mongoose Model for Items
const itemSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  description: String,
  category: String,
  price: Number,
  isActive: {
    type: Boolean,
    default: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

const Item = mongoose.model('Item', itemSchema);

// Middleware
app.use(express.json());
app.use(express.static('public')); // Serve static files

// Serve a simple HTML frontend
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
        <title>Item Manager</title>
        <style>
            body { font-family: Arial, sans-serif; margin: 40px; }
            .container { max-width: 800px; margin: 0 auto; }
            .form { margin-bottom: 20px; padding: 20px; border: 1px solid #ddd; border-radius: 5px; }
            input, textarea { width: 100%; padding: 8px; margin: 5px 0; border: 1px solid #ddd; border-radius: 3px; }
            button { background: #007bff; color: white; padding: 10px 20px; border: none; border-radius: 3px; cursor: pointer; }
            button:hover { background: #0056b3; }
            .item { border: 1px solid #eee; padding: 15px; margin: 10px 0; border-radius: 5px; }
            .actions { margin-top: 10px; }
            .delete { background: #dc3545; }
            .delete:hover { background: #c82333; }
        </style>
    </head>
    <body>
        <div class="container">
            <h1>Item Manager</h1>
            
            <div class="form">
                <h3>Add New Item</h3>
                <input type="text" id="name" placeholder="Item Name" required>
                <textarea id="description" placeholder="Description"></textarea>
                <input type="text" id="category" placeholder="Category">
                <input type="number" id="price" placeholder="Price" step="0.01">
                <button onclick="addItem()">Add Item</button>
            </div>

            <div id="itemsList">
                <h3>Items</h3>
                <div id="itemsContainer"></div>
            </div>
        </div>

        <script>
            // Load items when page loads
            loadItems();

            async function loadItems() {
                const response = await fetch('/api/items');
                const items = await response.json();
                const container = document.getElementById('itemsContainer');
                
                container.innerHTML = items.map(item => \`
                    <div class="item" id="item-\${item._id}">
                        <h4>\${item.name}</h4>
                        <p>\${item.description || 'No description'}</p>
                        <p><strong>Category:</strong> \${item.category || 'Uncategorized'} | 
                           <strong>Price:</strong> $\${item.price || '0.00'}</p>
                        <div class="actions">
                            <button onclick="editItem('\${item._id}')">Edit</button>
                            <button class="delete" onclick="deleteItem('\${item._id}')">Delete</button>
                        </div>
                    </div>
                \`).join('');
            }

            async function addItem() {
                const item = {
                    name: document.getElementById('name').value,
                    description: document.getElementById('description').value,
                    category: document.getElementById('category').value,
                    price: parseFloat(document.getElementById('price').value) || 0
                };

                const response = await fetch('/api/items', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(item)
                });

                if (response.ok) {
                    // Clear form
                    document.getElementById('name').value = '';
                    document.getElementById('description').value = '';
                    document.getElementById('category').value = '';
                    document.getElementById('price').value = '';
                    
                    // Reload items
                    loadItems();
                }
            }

            async function deleteItem(id) {
                if (confirm('Are you sure you want to delete this item?')) {
                    await fetch(\`/api/items/\${id}\`, { method: 'DELETE' });
                    loadItems();
                }
            }

            async function editItem(id) {
                const newName = prompt('Enter new name:');
                if (newName) {
                    await fetch(\`/api/items/\${id}\`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ name: newName })
                    });
                    loadItems();
                }
            }
        </script>
    </body>
    </html>
  `);
});

// API ROUTES

// GET all items
app.get('/api/items', async (req, res) => {
  try {
    const items = await Item.find().sort({ createdAt: -1 });
    res.json(items);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET single item
app.get('/api/items/:id', async (req, res) => {
  try {
    const item = await Item.findById(req.params.id);
    if (!item) {
      return res.status(404).json({ error: 'Item not found' });
    }
    res.json(item);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// CREATE new item
app.post('/api/items', async (req, res) => {
  try {
    const item = new Item(req.body);
    await item.save();
    res.status(201).json(item);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// UPDATE item
app.put('/api/items/:id', async (req, res) => {
  try {
    req.body.updatedAt = new Date();
    const item = await Item.findByIdAndUpdate(
      req.params.id, 
      req.body, 
      { new: true, runValidators: true }
    );
    
    if (!item) {
      return res.status(404).json({ error: 'Item not found' });
    }
    
    res.json(item);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// DELETE item
app.delete('/api/items/:id', async (req, res) => {
  try {
    const item = await Item.findByIdAndDelete(req.params.id);
    
    if (!item) {
      return res.status(404).json({ error: 'Item not found' });
    }
    
    res.json({ message: 'Item deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Health check
app.get('/health', async (req, res) => {
  const dbStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
  
  res.status(200).json({ 
    status: 'OK', 
    database: dbStatus,
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});
