import Express from "express";
import uploader from "./uploader";

const app = Express();

app.use(Express.json());
app.use((req, res, next) => {
  console.log(req.method, req.path);
  next();
});
app.use("/upload", uploader);
app.use(Express.static("static"));
app.use("/files", Express.static("files"));

app.listen(process.env.PORT ?? 3000, () => {
  console.log(`Listening on port ${process.env.PORT ?? 3000}!`);
});
