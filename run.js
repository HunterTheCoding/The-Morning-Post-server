const jwt = require("jsonwebtoken");
const { ObjectId } = require("mongodb");
const { client, app, verifyToken, stripe } = require(".");

async function run() {
  try {
    // Database Collection
    const NewsCollection = client.db("NewsDb").collection("AllNews");
    const JobsCollection = client.db("NewsDb").collection("AllJobs");
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
      const reqemail = req.params.email;
      const useremail = req.user.email;

      console.log(reqemail, useremail);

      if (reqemail === useremail) {
        console.log(`function is working`);

        try {
          // Query MongoDB collection
          const query = { "newDonation.email": reqemail };
          const result = await DonationRequestCollection.find(query).toArray(); // Invoke toArray as a method

          console.log(result);

          res.send({ result });
        } catch (error) {
          console.error("Error while querying database:", error);
          res.status(500).send("Internal Server Error");
        }
      } else {
        res.status(403).send("Forbidden"); // User is not authorized to access this email
      }
    });
    //  admin has access all donation list
    app.get("/Donation", verifyToken, verifyAdmin, async (req, res) => {
      const result = await DonationRequestCollection.find().toArray();
      // console.log(result);
      res.send(result);
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

    //  load all jobs
    app.get("/Jobs", async (req, res) => {
      // Fallback route when req.params.section is falsy
      const result = await JobsCollection.find().toArray();
      res.send(result);
    });

    // get bookemark data
    app.get("/Bookmark/:email", verifyToken, async (req, res) => {
      const userEmail = req?.user?.email;
      const reqEmail = req?.params?.email;

      // Ensure the requested email matches the user's email
      try {
        // Find all bookmarks for the user
        const query = {
          useremail: reqEmail,
        };
        const userBookmarks = await BookmarksCollection.find(query).toArray();

        // Extract news IDs from bookmarks
        const newsIds = userBookmarks.map(
          (bookmark) => new ObjectId(bookmark.newsid)
        );

        // Retrieve news data for the bookmarked news IDs
        const newsQuery = { _id: { $in: newsIds } };
        const bookmarkedNews = await NewsCollection.find(newsQuery).toArray();

        res.send(bookmarkedNews);
      } catch (error) {
        console.error("Error retrieving bookmarked news:", error);
        res.status(500).send({ message: "Internal server error" });
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

    //  All section Update Method
    // Bookmark Update
    // app.put("/Blood_Request_update/:id", verifyToken, async (req, res) => {
    //   const id = req.params.id;
    //   const updatedDonation = req.body;
    //   const filter = { _id: new ObjectId(id) };
    //   const options = { upsert: true };
    //   console.log("id", id);
    //   console.log("filter", filter);
    //   console.log(updatedDonation);
    //   const Donation = {
    //     $set: {
    //       recipient_name: updatedDonation?.recipient_name,
    //       address: updatedDonation?.address,
    //       District: updatedDonation?.District,
    //       Upazila: updatedDonation?.Upazila,
    //       hospital_name: updatedDonation?.hospital_name,
    //       donation_date: updatedDonation?.donation_date,
    //       donation_time: updatedDonation?.donation_time,
    //       hospital_name: updatedDonation?.hospital_name,
    //       Request_Message: updatedDonation?.Request_Message,
    //       donation_status: updatedDonation?.donation_status,
    //       requester_Name: updatedDonation?.requester_Name,
    //       requester_email: updatedDonation?.requester_email,
    //       requester_photo: updatedDonation?.requester_photo,
    //     },
    //   };
    //   console.log(Donation);
    //   const result = await DonationRequestCollection.updateOne(
    //     filter,
    //     Donation,
    //     options
    //   );
    //   console.log(result);
    //   res.send(result);
    // });
    // Use Delete Method
    // admin delete news
    app.delete("/AllNews/:id", verifyToken, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await NewsCollection.deleteOne(query);
      res.send(result);
    });
    // user delete donation
    app.delete("/Donation/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await DonationRequestCollection.deleteOne(query);
      res.send(result);
    });
    app.delete("/Bookmark/:id", verifyToken, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await BookmarksCollection.deleteOne(query);
      res.send(result);
    });
    app.delete("/Jobs/:id", verifyToken, async (req, res) => {
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
exports.run = run;
