import { Router } from "express";
import Multer from "multer"

const router = Router()
const storage = Multer.diskStorage({
    destination:(req, file, cb) => {
        cb(null, "./files")
    },
    filename: (req, file, cb) => {
        cb(null, `${file.fieldname}-${Date.now()}-${file.originalname}`)
    }
})
const upload = Multer({
    storage: storage,
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB
    }
})

const videoHandler = upload.single("video")
router.post("/",(req, res) => {
    videoHandler(req, res, (err) => {
        if (err) {
            console.log(err)
            res.status(500).send("Internal server error")
        }
        else {
            res.send("Hello Uploader!")
        }
    })
})

export default router