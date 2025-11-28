const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Serve static files from public directory
app.use(express.static(path.join(__dirname, 'public')));

// MongoDB Connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://admin:password@mongodb:27017/simpleapp?authSource=admin';

console.log('Attempting to connect to MongoDB...');

const connectWithRetry = () => {
    mongoose.connect(MONGODB_URI, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
        serverSelectionTimeoutMS: 5000,
    })
        .then(() => {
            console.log('✅ Connected to MongoDB successfully');
        })
        .catch((err) => {
            console.error('❌ Failed to connect to MongoDB:', err.message);
            console.log('🔄 Retrying connection in 5 seconds...');
            setTimeout(connectWithRetry, 5000);
        });
};

connectWithRetry();

// Item Schema
const itemSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    description: {
        type: String,
        required: true
    },
    quantity: {
        type: Number,
        default: 0
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

const Item = mongoose.model('Item', itemSchema);

// Debug endpoint
app.get('/api/debug', async (req, res) => {
    try {
        const db = mongoose.connection.db;
        const collections = await db.listCollections().toArray();
        const itemCount = await Item.countDocuments();
        const allItems = await Item.find().limit(5);

        res.json({
            database: mongoose.connection.name,
            connectionString: process.env.MONGODB_URI,
            collections: collections.map(c => c.name),
            itemCount: itemCount,
            connectionState: mongoose.connection.readyState,
            mongooseState: ['disconnected', 'connected', 'connecting', 'disconnecting'][mongoose.connection.readyState],
            sampleItems: allItems,
            sampleItemIds: allItems.map(item => item._id)
        });
    } catch (error) {
        res.json({ error: error.message });
    }
});

// Serve main page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Get all items
app.get('/api/items', async (req, res) => {
    try {
        if (mongoose.connection.readyState !== 1) {
            return res.status(503).json({ error: 'Database not connected' });
        }
        const items = await Item.find().sort({ createdAt: -1 });
        console.log(`📋 Retrieved ${items.length} items from database`);
        res.json(items);
    } catch (error) {
        console.error('Error fetching items:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get single item - UPDATED WITH BETTER ERROR HANDLING
app.get('/api/items/:id', async (req, res) => {
    try {
        console.log(`🔍 Looking for item with ID: ${req.params.id}`);

        if (mongoose.connection.readyState !== 1) {
            return res.status(503).json({ error: 'Database not connected' });
        }

        // Validate if the ID is a valid MongoDB ObjectId
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            console.log('❌ Invalid item ID format:', req.params.id);
            return res.status(400).json({ error: 'Invalid item ID format' });
        }

        const item = await Item.findById(req.params.id);

        if (!item) {
            console.log('❌ Item not found with ID:', req.params.id);

            // Let's see what items actually exist for debugging
            const allItems = await Item.find().select('_id name').limit(5);
            console.log('📝 Available items:', allItems);

            return res.status(404).json({
                error: 'Item not found',
                requestedId: req.params.id,
                availableItems: allItems
            });
        }

        console.log('✅ Item found:', item);
        res.json(item);
    } catch (error) {
        console.error('❌ Error fetching item:', error);
        res.status(500).json({ error: error.message });
    }
});

// Create new item
app.post('/api/items', async (req, res) => {
    try {
        console.log('📝 Received item creation request:', req.body);

        if (mongoose.connection.readyState !== 1) {
            return res.status(503).json({ error: 'Database not connected' });
        }

        const { name, description, quantity } = req.body;
        const newItem = new Item({
            name,
            description,
            quantity: parseInt(quantity) || 0
        });

        console.log('💾 Attempting to save item:', newItem);

        const savedItem = await newItem.save();
        console.log('✅ Item saved successfully:', savedItem._id);

        res.json(savedItem);
    } catch (error) {
        console.error('❌ Error saving item:', error);
        res.status(400).json({ error: error.message });
    }
});

// Update item
app.put('/api/items/:id', async (req, res) => {
    try {
        console.log(`✏️ Updating item with ID: ${req.params.id}`);

        if (mongoose.connection.readyState !== 1) {
            return res.status(503).json({ error: 'Database not connected' });
        }

        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ error: 'Invalid item ID format' });
        }

        const { name, description, quantity } = req.body;
        const updatedItem = await Item.findByIdAndUpdate(
            req.params.id,
            {
                name,
                description,
                quantity: parseInt(quantity) || 0
            },
            { new: true, runValidators: true }
        );

        if (!updatedItem) {
            console.log('❌ Item not found for update:', req.params.id);
            return res.status(404).json({ error: 'Item not found' });
        }

        console.log('✅ Item updated successfully:', updatedItem._id);
        res.json(updatedItem);
    } catch (error) {
        console.error('❌ Error updating item:', error);
        res.status(400).json({ error: error.message });
    }
});

// Delete item
app.delete('/api/items/:id', async (req, res) => {
    try {
        console.log(`🗑️ Deleting item with ID: ${req.params.id}`);

        if (mongoose.connection.readyState !== 1) {
            return res.status(503).json({ error: 'Database not connected' });
        }

        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ error: 'Invalid item ID format' });
        }

        const deletedItem = await Item.findByIdAndDelete(req.params.id);
        if (!deletedItem) {
            console.log('❌ Item not found for deletion:', req.params.id);
            return res.status(404).json({ error: 'Item not found' });
        }

        console.log('✅ Item deleted successfully:', req.params.id);
        res.json({ message: 'Item deleted successfully' });
    } catch (error) {
        console.error('❌ Error deleting item:', error);
        res.status(500).json({ error: error.message });
    }
});

// Start server
app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    console.log(`📊 Debug endpoint available at http://localhost:${PORT}/api/debug`);
});