import { Router } from 'express';
import {
  createNewsletterCampaign,
  createNewsletterSubscriber,
  deleteNewsletterSubscriber,
  getNewsletterCampaigns,
  getNewsletterSubscribers,
  getNewsletterSummary,
  sendNewsletterCampaign,
  updateNewsletterSubscriber,
} from '../../controllers/newsletterController';
import {
  handleValidationErrors,
  newsletterCampaignValidators,
  newsletterSubscriberValidators,
} from '../../middleware/validators';

const router = Router();

router.get('/summary', getNewsletterSummary);
router.get('/subscribers', getNewsletterSubscribers);
router.post('/subscribers', newsletterSubscriberValidators, handleValidationErrors, createNewsletterSubscriber);
router.put('/subscribers/:id', newsletterSubscriberValidators, handleValidationErrors, updateNewsletterSubscriber);
router.delete('/subscribers/:id', deleteNewsletterSubscriber);
router.get('/campaigns', getNewsletterCampaigns);
router.post('/campaigns', newsletterCampaignValidators, handleValidationErrors, createNewsletterCampaign);
router.post('/campaigns/:id/send', sendNewsletterCampaign);

export default router;
