require('dotenv').config();
const express=require('express');
const mongoose=require('mongoose');
const {connectdb}=require('./config/database.js');

const app=express();

connectdb()
    .then(()=>{
        console.log(`connected to mongodb successfully`);
        app.listen(process.env.PORT,()=>{
            console.log(`listening to ${process.env.PORT} successfully`);
        })
    })
    .catch((err)=>{
        console.log(`there's some issue with connecting to the mongodb ${err}`);
    });



