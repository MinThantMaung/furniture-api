import express from 'express';
import { changeLanguage, getProfileTest, uploadProfile, uploadProfileMultiple, uploadProfileOptimize } from '../../../controllers/api/profileController';
import upload, { uploadMemory } from '../../../middlewares/uploadFile';
import { auth } from '../../../middlewares/auth';
import { getPost, getInfinitePostsByPagination, getPostsByPagination } from '../../../controllers/api/postController';
import { getProduct, getProductsByPagination } from '../../../controllers/api/productController';

const router = express.Router();

router.post('/change-language', changeLanguage);
router.patch('/profile/upload', auth, upload.single('avater'),uploadProfile);
router.patch('/profile/upload/optimize', auth, upload.single("avater"),uploadProfileOptimize);
router.patch('/profile/upload/multiple', auth, upload.array('avater'),uploadProfileMultiple);

router.get("/profile/test", getProfileTest)

router.get("/posts", auth, getPostsByPagination)
router.get("/posts/infinite", auth, getInfinitePostsByPagination)
router.get("/posts/:id", auth, getPost)

router.get("/products/:id", auth, getProduct)
router.get("/products", auth, getProductsByPagination)

export default router;