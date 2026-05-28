import { Router } from 'express';
import {
  getEvents,
  getEvent,
  createEvent,
  updateEvent,
  deleteEvent,
  generateEventGroups,
  getEventGuests,
  reassignGuestGroup,
} from '../../controllers/eventController';
import { eventValidators, handleValidationErrors } from '../../middleware/validators';

const router = Router();

router.get('/', getEvents);
router.get('/:id', getEvent);
router.post('/', eventValidators, handleValidationErrors, createEvent);
router.put('/:id', updateEvent);
router.delete('/:id', deleteEvent);
router.post('/:id/generate-groups', generateEventGroups);
router.get('/:id/guests', getEventGuests);
router.patch('/:id/reassign-guest', reassignGuestGroup);

export default router;
