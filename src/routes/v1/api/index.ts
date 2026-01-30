import express from 'express';
import { changeLanguage, getProfileTest, uploadProfile, uploadProfileMultiple, uploadProfileOptimize } from '../../../controllers/api/profileController';
import upload, { uploadMemory } from '../../../middlewares/uploadFile';
import { auth } from '../../../middlewares/auth';

const router = express.Router();

router.post('/change-language', changeLanguage);
router.patch('/profile/upload', auth, upload.single('avater'),uploadProfile);
router.patch('/profile/upload/optimize', auth, uploadMemory.single("avater"),uploadProfileOptimize);
router.patch('/profile/upload/multiple', auth, upload.array('avater'),uploadProfileMultiple);

router.get("/profile/test", getProfileTest)


export default router;