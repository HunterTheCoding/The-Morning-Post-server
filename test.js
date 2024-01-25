const express = require('express');
const mongoose = require('mongoose');
const app = express();
app.use(express.json())
const port = process.env.PORT|| 3000

    mongoose.connect("mongodb://localhost/checkMongoose")
    .then(() => {
        console.log("connect to mongoose");
    }).catch((err) => {
        console.log(err);
    });
async function run( err,req,res,next) {
  
  }
  

  app.listen(port, () => {
    console.log(`Server is Running On ${port}`);
  });
  