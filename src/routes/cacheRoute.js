const express = require('express');
const wordCache = require('../utils/cacheManager');

const router = express.Router();

// GET /api/cache - Get current contents of cache from MRU position to LRU position

router.get('/', (req,res)=>{
    try {
        const cacheContents = wordCache.getContents();

        res.json({
            cacheSize: cacheContents.length,
            cache: cacheContents,
        });
    }
    catch(err) {
        res.status(500).json({
            message: 'Server error',
            error: err.message
        });
    }
});

// GET /api/cache/:term - Check if the term is in the cache
router.get('/:term', (req,res)=>{
    try{
        const term = req.params.term.toLowerCase();
        const cachedWord = wordCache.get(term);

        if(!cachedWord){
            return res.status(404).json({
                message: 'Term not found in the cache'
            });
        }

        res.json({
            message: 'Term found in cache',
            word: cachedWord
        });
    }

    catch(err) {
        res.status(500).json({
            message: 'server error',
            error: err.message 
        });
    }

});

//DELETE /api/cache - clear entire cache

router.delete('/', (req,res) => {
    try {
        wordCache.clear();
        res.json({
            message: 'Cache cleared successfully'
        });
    }
    catch(err) {
        res.status(500).json({
            message: 'Server error',
            error: err.message 
        });
    }

});

module.exports = router;


