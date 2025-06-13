//Implement LRU Cache using a Doubly Linked list and HashMap

class Node { //node class for doubly linked list
    constructor(key, value) {
        this.key = key;
        this.value = value;
        this.prev = null;
        this.next = null;
    }
}

class LRUCache {
    constructor(capacity) {
        this.capacity = capacity;
        this.cache = {};
        this.size = 0;

        //initialize head and tail nodes
        this.head = new Node('head', null);
        this.tail = new Node('tail', null)

        //connect head and tail
        this.head.next = this.tail;
        this.tail.prev = this.head;
    }

    //move a node to front - most recently used position
    
    moveToFront(node) {
        this.removeNode(node);
        this.addToFront(node);
    }

    //remove a node from the linked list
    removeNode(node) {
        const prev = node.prev;
        const next = node.next;

        prev.next = next;
        next.prev = prev;
    }

    //add a node to the front of the linkedlist
    addToFront(node) {
        node.next = this.head.next;
        node.prev = this.head;

        this.head.next.prev = node;
        this.head.next = node;
    }

    // Remove the least recently used node from the tail
    removeLRU() {
        const lruNode = this.tail.prev;
        if(lruNode === this.head) {
            return null; //cache is empty
        }

        this.removeNode(lruNode);
        return lruNode.key;
    }

    //get an item from the cache and move it to the front - Most recently used (MRU) position
    get(key) {
        if(!(key in this.cache)) {
            return undefined;
        }

        const node = this.cache[key];
        this.moveToFront(node); //moves to MRU position
        return node.value;
   }


   // Put a key value pair in the cache
    put(key,value) {
        // If key already exist update its value and move it to MRU position
        if(key in this.cache) {
            const node = this.cache[key];
            node.value = value;
            this.moveToFront(node);
            return;
        }

        // If at capacity remove the LRU item
        if(this.size === this.capacity) {
            const lruKey = this.removeLRU();
            delete this.cache[lruKey];
            this.size--;
        }

        //create a new node and add it to the front
        const newNode = new Node(key, value);
        this.addToFront(newNode);
        this.cache[key] = newNode;
        this.size++;
    }

    // Remove a key from the cache
    delete(key) {
        if(!(key in this.cache)){
            return false;
        }
        
        const node = this.cache[key];
        this.removeNode(node);
        delete this.cache[key];
        this.size--;
        return true;
    }

    // clear the entire cache
    clear() {
        this.cache = {};
        this.size = 0;
        this.head.next = this.tail;
        this.tail.prev = this.head;
    }

    //get current contents of cache from MRU position to LRU position
    getContents() {
        const contents = [];
        let current = this.head.next;

        while((current !== this.tail)){
            contents.push({
                key: current.key,
                value: current.value,
            });

            current = current.next;
        }

        return contents;
    }

    //check if the key exists in the cache
    has(key) {
        return key in this.cache; //If key exists it will return true else false
    }
}

module.exports = LRUCache;