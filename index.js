const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const port = process.env.PORT || 5000;
require("dotenv").config();
const app = express();
app.use(express.json());
app.use(
  cors({
    origin: ["https://offline-sharing-service.surge.sh/"],
    credentials: true,
  })
);

app.use(cookieParser());
console.log(process.env.DB_USER);

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.pahimj1.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,

    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Database Collection 
    const NewsCollection = client.db("NewsDb").collection("AllNews")

    // Use Post Method

    //   Create News Section
    app.post("/News", async (req, res) => {
      const News = req.body;
      console.log("News ", News);
      const result = await NewsCollection.insertOne(News);
      console.log(result);
      // res.send(result);
      res.send(result);
    });


// Use Get Method


app.get("/AllNews",  async (req, res) => {
  const result = await NewsCollection.find().toArray();
  res.send(result);
});

// Use Delete Method


app.delete("/AllNews/:id", async (req, res) => {
  const id = req.params.id;
  const query = { _id: new ObjectId(id) };
  const result = await NewsCollection.deleteOne(query);
  res.send(result);
});

    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();
    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("The Morning Server Is Running");
});
app.listen(port, () => {
  console.log(`Server is Running On ${port}`);
});
