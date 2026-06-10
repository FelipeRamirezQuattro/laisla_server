import { Router } from 'express';
import {
  createNewsletterCampaign,
  getNewsletterCampaigns,
  getNewsletterSubscribers,
  getNewsletterSummary,
  sendNewsletterCampaign,
} from '../../controllers/newsletterController';
import { handleValidationErrors, newsletterCampaignValidators } from '../../middleware/validators';

const router = Router();

router.get('/summary', getNewsletterSummary);
router.get('/subscribers', getNewsletterSubscribers);
router.get('/campaigns', getNewsletterCampaigns);
router.post('/campaigns', newsletterCampaignValidators, handleValidationErrors, createNewsletterCampaign);
router.post('/campaigns/:id/send', sendNewsletterCampaign);

export default router;
