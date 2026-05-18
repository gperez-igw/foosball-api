import { Test } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminOverrideService } from '@app/matches/services/admin-override.service';
import { DlqInspectorService } from '@app/events';

const mockAdminOverrideService = () => ({
  overrideResult: jest.fn(),
  deleteMatch: jest.fn(),
  getAuditLog: jest.fn(),
});

const mockDlqInspectorService = () => ({
  listFailed: jest.fn(),
  retryJob: jest.fn(),
});

describe('AdminController', () => {
  let controller: AdminController;
  let dlqService: ReturnType<typeof mockDlqInspectorService>;

  beforeEach(async () => {
    dlqService = mockDlqInspectorService();

    const module = await Test.createTestingModule({
      controllers: [AdminController],
      providers: [
        { provide: AdminOverrideService, useValue: mockAdminOverrideService() },
        { provide: DlqInspectorService, useValue: dlqService },
      ],
    }).compile();

    controller = module.get(AdminController);
  });

  describe('retryDlqJob', () => {
    it('throws BadRequestException (QUEUE_REQUIRED) when queue param is omitted', async () => {
      await expect(controller.retryDlqJob('job-123')).rejects.toThrow(BadRequestException);
      await expect(controller.retryDlqJob('job-123')).rejects.toMatchObject({
        response: expect.objectContaining({ code: 'QUEUE_REQUIRED' }),
      });
      // The underlying service must NOT be called when queue is missing
      expect(dlqService.retryJob).not.toHaveBeenCalled();
    });

    it('throws BadRequestException when queue is an empty string', async () => {
      await expect(controller.retryDlqJob('job-123', '')).rejects.toThrow(BadRequestException);
      expect(dlqService.retryJob).not.toHaveBeenCalled();
    });

    it('calls retryJob with the provided queue and returns {jobId, status}', async () => {
      dlqService.retryJob.mockResolvedValue(undefined);

      const result = await controller.retryDlqJob('job-123', 'matches');

      expect(dlqService.retryJob).toHaveBeenCalledWith('matches', 'job-123');
      expect(result).toEqual({ jobId: 'job-123', status: 'requeued' });
    });

    it('throws NotFoundException (JOB_NOT_FOUND) when service throws "not found"', async () => {
      dlqService.retryJob.mockRejectedValue(new Error('Job job-xyz not found in queue matches'));

      await expect(controller.retryDlqJob('job-xyz', 'matches')).rejects.toThrow(NotFoundException);
      await expect(controller.retryDlqJob('job-xyz', 'matches')).rejects.toMatchObject({
        response: expect.objectContaining({ code: 'JOB_NOT_FOUND' }),
      });
    });

    it('re-throws unexpected errors from service', async () => {
      dlqService.retryJob.mockRejectedValue(new Error('Redis connection refused'));

      await expect(controller.retryDlqJob('job-abc', 'audit')).rejects.toThrow('Redis connection refused');
    });
  });

  describe('listDlqJobs', () => {
    it('lists jobs across all queues when queue param is omitted', async () => {
      dlqService.listFailed.mockResolvedValue([]);

      const result = await controller.listDlqJobs();

      expect(dlqService.listFailed).toHaveBeenCalledWith(undefined);
      expect(result).toEqual({ data: [] });
    });

    it('lists jobs for a specific queue when queue param is provided', async () => {
      dlqService.listFailed.mockResolvedValue([]);

      await controller.listDlqJobs('leaderboard');

      expect(dlqService.listFailed).toHaveBeenCalledWith('leaderboard');
    });
  });
});
