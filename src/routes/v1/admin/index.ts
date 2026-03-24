import express from "express";
import { getAllUsers } from "../../../controllers/admin/userController";
import { setMaintenance } from "../../../controllers/admin/systemController";
import upload from "../../../middlewares/uploadFile";
import {
  createPost,
  deletePost,
  updatePost,
} from "../../../controllers/admin/postController";
import {
  createProduct,
  deleteProduct,
  updateProduct,
} from "../../../controllers/admin/productController";

const router = express.Router();

router.get("/users", getAllUsers);
router.post("/maintenance", setMaintenance);

router.post("/posts", upload.single("image"), createPost);
router.patch("/posts", upload.single("image"), updatePost);
router.delete("/posts", deletePost);

router.post("/products", upload.array("images", 4), createProduct);
router.patch("/products", upload.array("images"), updateProduct);
router.delete("/products", deleteProduct);

export default router;
