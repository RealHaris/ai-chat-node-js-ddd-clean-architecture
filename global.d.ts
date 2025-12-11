import express from "express";

declare global {
  interface ContextRequest extends express.Request {
    requestId?: string;
    startTime?: number;
    fields?: any;
  }
}
