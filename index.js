const express = require("express");
require("dotenv").config();
const cors = require("cors");
const jwt = require("jsonwebtoken");
const stripe = require("stripe")(process.env.STRIPE_SECRET);
const cookieParser = require("cookie-parser");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const port = process.env.PORT || 5000;
const app = express();
app.use(express.json());
app.use(
  cors({
    origin: [
      "http://localhost:5173",
      // "http://localhost:5174",
      "https://the-morning-posts.surge.sh",
    ],
    credentials: true,
  })
);
console.log(process.env.STRIPE_SECRET);

app.use(cookieParser());
// console.log(process.env.DB_USER);

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.pahimj1.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

const verifyToken = (req, res, next) => {
  const token = req.cookies.token;
  // console.log(token);

  if (!token) {
    console.log("token nai");
    return res.status(401).send({ message: "unauthorized access" });
  }
  jwt.verify(token, process.env.NEWS_ACCESS_TOKEN, (err, decoded) => {
    if (err) {
      console.log(err);
      return res.status(401).send({ message: "unauthorized access" });
    }
    req.user = decoded;
    // console.log(req.user);
    next();
  });
};

async function run() {
  try {
    // Database Collection
    const NewsCollection = client.db("NewsDb").collection("AllNews");
    const UserCollection = client.db("NewsDb").collection("Users");
    const BookmarksCollection = client.db("NewsDb").collection("BookMark");
    const DonationRequestCollection = client
      .db("NewsDb")
      .collection("Donation");

    // Verify Admin
    const verifyAdmin = async (req, res, next) => {
      const email = req.user?.email;
      const query = { Email: email };
      const user = await UserCollection.findOne(query);
      // console.log(email,user);
      const IsAdmin = user.role === "admin";

      if (!IsAdmin) {
        console.log("error");
        return res.status(401).send({ message: "unauthorized User" });
      } else {
        next();
      }
    };

    // Use Post Method

    // JsonWebToken
    app.post("/jwt", async (req, res) => {
      const user = req.body;
      // console.log('user token');
      const token = jwt.sign(user, process.env.NEWS_ACCESS_TOKEN, {
        expiresIn: "1d",
      });
      // console.log('user for token', token,user);

      res
        .cookie("token", token, {
          httpOnly: true,
          secure: true,
          sameSite: "none",
        })
        .send({ success: true });
    });

    // Logout user

    app.post("/logout", async (req, res) => {
      const user = req.body;
      // console.log("logging out", user);
      res.clearCookie("token", { maxAge: 0 }).send({ success: true });
    });

    app.post("/bookmarks", async (req, res) => {
      const newsinfo = req.body;
      // console.log(newsinfo)
      const result = await BookmarksCollection.insertOne(newsinfo);
      res.send(result);
    });
    //   Create News Section
    app.post("/News", async (req, res) => {
      const News = req.body;
      //   console.log("News ", News);
      const result = await NewsCollection.insertOne(News);
      // console.log(result);
      // res.send(result);
      res.send(result);
    });
    //   Create User Section
    app.post("/users", async (req, res) => {
      const User = req.body;
      console.log("auth user", User);
      const query = { Email: User?.Email };
      const Exitinguser = await UserCollection.findOne(query);
      console.log(Exitinguser);
      if (Exitinguser) {
        console.log("user ase");
        return res.send({ message: "user already exist", insertedId: null });
      }
      const result = await UserCollection.insertOne(User);
      // console.log(result);
      return res.send(result);
    });

    // create donation
    app.post("/donation-request", verifyToken, async (req, res) => {
      const DonationRequest = req.body;
      console.log(DonationRequest);

      const result = await DonationRequestCollection.insertOne(DonationRequest);
      console.log(result);
      return res.send(result);
    });

    // implement script payment

    app.post("/create-payment-intent", async (req, res) => {
      const { amount } = req.body;
      console.log(req.body);
      const amountInCents = parseInt(amount);
      // Create a PaymentIntent with the order amount and currency
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amountInCents,
        currency: "usd",
        payment_method_types: ["card"],
      });
      console.log(paymentIntent);

      res.send({
        clientSecret: paymentIntent.client_secret,
      });
    });

    // Use Get Method

    // donation details show
    app.get("/donation/:email", verifyToken, async (req, res) => {
      const email = req.params.email;
      const query = { email: email };
      const result = await DonationRequestCollection.find(query).toArray;

      res.send({ result });
    });
    app.get("/News/:section?", async (req, res) => {
      if (req.params.section) {
        // Dynamic route when req.params.section is truthy
        const query = {
          section: req.params.section,
        };
        const result = await NewsCollection.find(query).toArray();

        // console.log(",", result);
        res.send(result);
      } else {
        // Fallback route when req.params.section is falsy
        const result = await NewsCollection.find().toArray();
        res.send(result);
      }
    });

    // get bookemark data

    app.get("/Bookmark/:email", async (req, res) => {
      // console.log("Checking user email", req?.user?.email);
      const userEmail = req?.user?.email;
      const reqEmail = req?.params?.email;
      
      // Ensure the requested email matches the user's email
      if (userEmail === reqEmail) {
        try {
          // Find all bookmarks for the user
          const query = { email: reqEmail };
          const userBookmarks = await BookmarksCollection.find(query).toArray();
    
          // Extract news IDs from bookmarks
          const newsIds = userBookmarks.map(bookmark => bookmark.newsid);
    
          // Retrieve news data for the bookmarked news IDs
          const newsQuery = { _id: { $in: newsIds } };
          const bookmarkedNews = await NewsCollection.find(newsQuery).toArray();
    
          res.send(bookmarkedNews);
        } catch (error) {
          console.error("Error retrieving bookmarked news:", error);
          res.status(500).send({ message: "Internal server error" });
        }
      } else {
        return res.status(401).send({ message: "Unauthorized User" });
      }
    });
    

    // Check Admin

    app.get("/admin/:email", verifyToken, async (req, res) => {
      // console.log("asoe hlit hocche", req?.user?.email);
      const email = req.params.email;

      // console.log(req?.user, "emaillllllll", email);
      if (email !== req?.user?.email) {
        return res.status(403).send({ message: "unauthorized Access" });
      }
      const query = { Email: email };
      const user = await UserCollection.findOne(query);

      let isAdmin = false;
      if (user?.role === "admin") {
        isAdmin = true;
      }
      console.log(isAdmin, "admin");
      res.send({ isAdmin });
    });

    // show all user
    app.get("/Users", verifyToken, verifyAdmin, async (req, res) => {
      console.log("cheack to token", req?.user?.email);
      // console.log(req.user);
      const result = await UserCollection.find().toArray();
      // console.log(result);
      res.send(result);
    });

    // Use Delete Method

    app.delete("/AllNews/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await NewsCollection.deleteOne(query);
      res.send(result);
    });
  
    app.get("/singlenews/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      // console.log(id)
      const result = await NewsCollection.findOne(query);
      // console.log(result);
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
