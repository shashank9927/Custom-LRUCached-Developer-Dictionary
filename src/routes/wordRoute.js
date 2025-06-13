const express = require('express');
const Word = require('../models/wordModel');
const wordCache = require('../utils/cacheManager');

const router = express.Router();

// helper function to clear pagination entries

const clearPaginationCache = () => {
    // get all cache contents
    const cacheContents = wordCache.getContents();

    // Find and remove all pagination cache entries
    cacheContents.forEach((item) => {
        if(item.key.startsWith('list_')) {
            wordCache.delete(item.key);
        }
    });
};

// GET /api/words/:term - Get a term by name - Use LRU cache for faster lookup
router.get('/:term', async(req, res) => {
    const term = req.params.term.toLowerCase();

    console.time(`Get term: ${term}`);
    try {

        //check if the term is in the cache
        const cachedWord = wordCache.get(term);

        if(cachedWord) {
            console.timeEnd(`Get term: ${term}`);
            return res.json({
                word: cachedWord,
                source: 'cache',
                message: 'Term retrieved from cache'
            });
        }

        // If term not in cache fetch it from MongoDB
        const word = await Word.findOne({term});

        if(!word) {
            console.timeEnd(`Get term: ${term}`);
            return res.status(404).json({
                message: 'Term not found'
            });
        }

        // Store it in cache for future lookup
        wordCache.put(term, word);

        console.timeEnd(`Get term: ${term}`);
        res.json({
            word,
            source: 'database',
            message: 'Term retrieved from database and added to cache'
        });
    }

    catch(err) {
        console.timeEnd(`Get term: ${term}`);
        res.status(500).json({
            message: 'Server error',
            error: err.message
        });
    }
} );

// GET /api/words - Get all terms with pagination and filtering

router.get('/', async(req,res)=> {
    try {
        // extract pagination parameter
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;

        //build filter
        const filter = {};

        //term filter
        if(req.query.term) {
            filter.term = {$regex : req.query.term, $options: 'i'};
        }

        // tags filter
        if(req.query.tags) {
            const tags = req.query.tags.split(',').map(tag => tag.trim().toLowerCase());
            filter.tags = { $in: tags};
        }

        // Generate a cache key based on query parameters
        const cacheKey = `list_${page}_${limit}_${JSON.stringify(filter)}`;
        console.time(`List words: ${cacheKey}`);

        const cachedResult = wordCache.get(cacheKey);

        //check if the result is in the cache
        if(cachedResult) {
            console.timeEnd(`List words: ${cacheKey}`);
            return res.json({
                ...cachedResult,
                source: 'cache',
                message: 'Result retrieved from cache'
            });

        }

        // If not in the cache query the database and count total matching documents
        const totalItems = await Word.countDocuments(filter);
        const totalPages = Math.ceil(totalItems/limit);

        //execute query with pagination
        const words = await Word.find(filter)
                                        .skip(skip)
                                        .limit(limit)
                                        .sort({term: 1});
        
        // prepare result object
        const result = {
            words,
            pagination: {
                totalItems,
                totalPages,
                currentPage: page,
                pageSize: limit 
            }
        };

        // store in cache for future request
        wordCache.put(cacheKey, result);

        console.timeEnd(`List words: ${cacheKey}`);
        res.json({
            ...result,
            source: 'database',
            message: 'Result retrieved from the database and stored in cache'
        });
    }
    catch(err) {
        res.status(500).json({
            message: 'Server error',
            error: err.message
        });
    }
});

// POST /api/words - add new terms

router.post('/', async(req, res) => {
    try {
        const {term, definitions, tags} = req.body;

        if(!term || !definitions || !Array.isArray(definitions) || definitions.length === 0) {
            return res.status(400).json({
                message: 'Term and atleast one definition is required'
            });
        }

        // check if term already exist in database
        const existingTerm = await Word.findOne({term: term.toLowerCase()});

        if(existingTerm) {
            return res.status(409).json({
                message: 'Term already exists'
            });
        }

        //create a new term
        const newWord = new Word({
            term: term.toLowerCase(),
            definitions,
            tags: tags || []
        });

        await newWord.save();

        //as data is changed, clear pagination cache
        clearPaginationCache();

        res.status(201).json({
            message: 'Term added successfully',
            word: newWord
        });
    }

    catch(err) {
        res.status(500).json({
            message: 'Server error',
            error: err.message 
        });
    }
});

// POST /api/words/bulk - add multiple terms in bulk
router.post('/bulk', async(req,res)=> {
    try{
        const {words} = req.body;

        if(!words || !Array.isArray(words) || words.length === 0) {
            return res.status(400).json({
                message: 'A non-empty array of words required'
            });
        }

        //validate each word entry
        for( const word of words){
            if(!word.term || !word.definitions || !Array.isArray(word.definitions)|| word.definitions.length ===0){
                return res.status(400).json({
                    message: 'Each word must have a term and at least one definition',
                    invalidWord: word
                });

            }
        }

        const results = {
            added: [],
            skipped: []
        }

        //Process each word
        for(const wordData of words){
            const term = wordData.term.toLowerCase();

            //check if term already exist
            const existingTerm = await Word.findOne({term});

            if(existingTerm) {
                //skip existing term
                results.skipped.push({
                    term,
                    reason: 'Term already exists'
                });
                continue;
            }

            //create the new term
            const newWord = new Word({
                term,
                definitions: wordData.definitions,
                tags: wordData.tags || []

            });

            await newWord.save();
            results.added.push(newWord);
        }

        //clear pagination cache as data has changed
        clearPaginationCache();

        res.status(201).json({
            message: `Bulk operation completed. Added: ${results.added.length}, Skipped: ${results.skipped.length}`,
            results 
        });
    }
    catch(err){
        res.status(500).json({
            message: 'Server error',
            error: err.message 
        });
    }
});

// PUT /api/words/:term - Update a term
router.put('/:term', async(req,res)=>{
    try{
        const term = req.params.term.toLowerCase();
        const {definitions, tags} = req.body;

        if(!definitions || !Array.isArray(definitions) || definitions.length === 0) {
            return res.status(400).json({
                message: 'Atleast one definition is required'
            });
        }

        //find and update the term
        const updatedWord = await Word.findOneAndUpdate(
            {term},
            {
                definitions,
                tags: tags || [],
                updatedAt: Date.now()
            },
            {new: true, runValidators: true}
            
        );

        if(!updatedWord) {
            return res.status(404).json({
                message: 'Term not found'
            });
        }

        //Update the cache if the term exist
        if(wordCache.has(term)){
            wordCache.put(term, updatedWord);
        }

        //clear pagination cache as data has been changed
        clearPaginationCache();

        res.json({
            message: 'Term updated successfully',
            word: updatedWord
        });
    }

    catch(err){
        res.status(500).json({
            message: 'Server error',
            error: err.message
        });
    }

});

// DELETE /api/words/:term - Delete a term
router.delete('/:term', async(req,res)=>{
    try{
        const term = req.params.term.toLowerCase();

        const deletedWord = await Word.findOneAndDelete({term});

        if(!deletedWord) {
            return res.status(404).json({
                message: 'Term not found'
            });
        }

        //remove from cache if present
        wordCache.delete(term);

        //clear pagination cache as data is changed
        clearPaginationCache();

        res.json({
            message: 'Term deleted successfully',
            word: deletedWord
        });
  
    }

    catch(err){
        res.status(500).json({
            message: 'Server error',
            error: err.message
        });
    }
});

module.exports = router;




