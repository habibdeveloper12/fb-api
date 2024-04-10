const express = require("express");
const app = express();
require("dotenv").config();
const passport = require("passport");
app.use(express.static("public"));
app.use(express.json());
const FacebookStrategy = require("passport-facebook").Strategy;
app.listen(4242, () => console.log("Node server listening on port 4242!"));
const cors = require("cors");
const { MongoClient, ServerApiVersion } = require("mongodb");
const port = process.env.PORT || 5000;

const uri = `mongodb://localhost:27017/database?retryWrites=true&w=majority`;
const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});
console.log(uri);

app.use(cors());
app.use(express.json());

async function run() {
  try {
    await client.connect();
    const fbApi = client.db("fb").collection("message");
    const { Facebook } = require("fb");
    const fb = new Facebook({ version: "v12.0" });
    const FB_APP_ID = "350708251284818";
    const FB_APP_SECRET = "9377f8aeecebf304c6f61c1678fbb6c1";
    const FB_REDIRECT_URI = "http://localhost:5000/auth/callback";
    const clientID = "350708251284818";
    const clientSecret = "9377f8aeecebf304c6f61c1678fbb6c1";
    // Passport Facebook Strategy
    passport.use(
      new FacebookStrategy(
        {
          clientID: "350708251284818",
          clientSecret: "9377f8aeecebf304c6f61c1678fbb6c1",
          callbackURL: "http://localhost:5000/auth/facebook/callback",
          profileFields: ["id", "displayName", "email", "manage_pages"],
        },
        function (accessToken, refreshToken, profile, done) {
          // This function is called after successful authentication
          // Here, you can handle user authentication or retrieve user data
          return done(null, profile);
        }
      )
    );

    app.get(
      "/auth/facebook",
      passport.authenticate("facebook", {
        scope: ["manage_pages", "read_page_mailboxes"],
      })
    );

    app.get(
      "/auth/facebook/callback",
      passport.authenticate("facebook", { failureRedirect: "/login" }),
      function (req, res) {
        // Successful authentication, redirect or respond as needed
        console.log("success", req);
        res.redirect("/messages");
      }
    );

    app.get("/login", (req, res) => {
      const response = axios.get(
        `https://graph.facebook.com/oauth/access_token?client_id=${clientID}&client_secret=${clientSecret}&grant_type=client_credentials`
      );
      console.log("Access Token Response:", response.data);
      res.render("login");
    });

    app.get("/auth/initiate", (req, res) => {
      const authUrl = fb.getLoginUrl({
        client_id: FB_APP_ID,
        redirect_uri: FB_REDIRECT_URI,
        scope: "manage_pages",
      });
      res.redirect(authUrl);
    });

    app.get("/auth/callback", (req, res) => {
      const { code } = req.query;
      try {
        const { access_token } = fb.api("oauth/access_token", {
          client_id: FB_APP_ID,
          client_secret: FB_APP_SECRET,
          redirect_uri: FB_REDIRECT_URI,
          code,
        });
        const userInfo = fb.api("/me", {
          access_token: access_token,
        });
        // const userId = userInfo.id;
        // const userPagesResponse = await fb.api(`/${userId}/accounts`, {
        //   access_token: access_token,
        // });
        return {
          success: true,
          message: "Here is user Info",
          data: userInfo,
          redirectUrl: "/specific-page",
        };
      } catch (error) {
        console.error("Error saving authentication data:", error);
        // Return a failure message and redirect user
        return {
          success: false,
          message: "Failed to save authentication data",
          redirectUrl: "/error-page",
        };
      }
    });

    app.post("/auth/store", async (req, res) => {
      const { accessToken } = req.body;

      try {
        const response = await axios.get(
          `https://graph.facebook.com/me/messages`,
          {
            params: {
              access_token: accessToken,
            },
          }
        );

        await client.connect();

        const database = client.db("facebook_messages");
        const collection = database.collection("messages");

        const result = await collection.insertMany(response.data.data);

        console.log("Messages saved successfully:", result);
        res.json({ success: true, message: "Messages saved successfully" });
      } catch (error) {
        console.error("Error fetching and storing messages:", error);
        res
          .status(500)
          .json({
            success: false,
            message: "Failed to fetch and store messages",
          });
      } finally {
        await client.close();
      }
    });

    app.post("/auth/refresh", (req, res) => {
      const { accessToken } = req.body;
      const response = axios.get(`https://graph.facebook.com/debug_token`, {
        params: {
          input_token: accessToken,
          access_token: "your-app-access-token",
        },
      });

      if (response.data.data.is_valid) {
        console.log("Access token is valid");
      } else {
        res.redirect("/auth/initiate");
      }
      res.status(200).send("Authentication data refreshed successfully");
    });

    app.delete("/auth/remove", async (req, res) => {
      const { userId } = req.body;

      try {
        await client.connect();

        const database = client.db("your-database-name");
        const collection = database.collection("authenticationData");

        const result = await collection.deleteOne({ userId: userId });

        if (result.deletedCount === 1) {
          res.json({
            success: true,
            message: "Authentication data removed successfully",
          });
        } else {
          res.status(404).json({
            success: false,
            message: "User authentication data not found",
          });
        }
      } catch (error) {
        console.error("Error removing authentication data:", error);
        res.status(500).json({
          success: false,
          message: "Failed to remove authentication data",
        });
      } finally {
        await client.close();
      }
    });
    app.post("/auth/reverify", (req, res) => {
      const { userId } = req.body;

      try {
        const authUrl = `https://www.facebook.com/v12.0/dialog/oauth?client_id=${FB_APP_ID}&redirect_uri=${encodeURIComponent(
          FB_REDIRECT_URI
        )}&scope=manage_pages&auth_type=reauthenticate&state=${userId}`;

        res.json({ success: true, redirectUrl: authUrl });
      } catch (error) {
        console.error("Error triggering permission re-verification:", error);
        res.status(500).json({
          success: false,
          message: "Failed to trigger permission re-verification",
        });
      }
    });
  } finally {
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Hello World!");
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
