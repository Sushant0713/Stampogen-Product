'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import toast from 'react-hot-toast';
import { loyaltyService } from '@/services/loyalty.service';
import { getErrorMessage } from '@/utils';

export function CustomerScanFlow({ slug }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const offerTitle = searchParams.get('offer') || 'Stamp';
  const offerKey = searchParams.get('offerKey') || '';

  const videoRef = useRef(null);
  const streamRef = useRef(null);

  const [photo, setPhoto] = useState('');
  const [cameraError, setCameraError] = useState('');
  const [cameraReady, setCameraReady] = useState(false);
  const [busy, setBusy] = useState(false);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks()?.forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraReady(false);
  }, []);

  const startCamera = useCallback(async () => {
    setCameraError('');
    setPhoto('');
    stopCamera();

    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError('Camera is not supported on this device or browser.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraReady(true);
    } catch {
      setCameraError('Allow camera access to photograph your bill.');
      setCameraReady(false);
    }
  }, [stopCamera]);

  useEffect(() => {
    startCamera();
    return () => stopCamera();
  }, [startCamera, stopCamera]);

  const capturePhoto = () => {
    const video = videoRef.current;
    if (!video || !cameraReady) {
      toast.error('Camera is not ready yet');
      return;
    }

    const width = video.videoWidth || 720;
    const height = video.videoHeight || 960;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      toast.error('Unable to capture photo');
      return;
    }
    ctx.drawImage(video, 0, 0, width, height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
    setPhoto(dataUrl);
    stopCamera();
  };

  const retake = () => {
    startCamera();
  };

  const confirm = async () => {
    if (!photo) {
      toast.error('Take a photo of your bill first');
      return;
    }
    try {
      setBusy(true);
      const { data } = await loyaltyService.addStamp(slug, {
        offerKey: offerKey || undefined,
        offerTitle,
        billDocument: photo,
        billDocumentName: `bill-${Date.now()}.jpg`,
      });
      toast.success(data.message || '+1 stamp collected!');
      router.push(`/app/cards/${slug}`);
    } catch (error) {
      toast.error(getErrorMessage(error, 'Unable to add stamp'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-5">
      <div className="flex items-center gap-3">
        <Link
          href={`/app/cards/${slug}/offers`}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-white shadow-[0_2px_8px_rgba(2,26,84,0.08)]"
          aria-label="Back"
        >
          <svg width="9" height="15" viewBox="0 0 9 15" fill="none" aria-hidden>
            <path
              d="M8 1L1 7.5L8 14"
              stroke="#021A54"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </Link>
        <div>
          <h1 className="text-xl font-extrabold text-[#021A54]">Photograph your bill</h1>
          <p className="text-[12.5px] font-medium text-[#64748B]">{offerTitle}</p>
        </div>
      </div>

      <div className="overflow-hidden rounded-[24px] bg-[#0B0B0F] p-5 text-white shadow-[0_16px_40px_rgba(2,26,84,0.2)]">
        <div className="relative mx-auto aspect-square max-w-[280px] overflow-hidden rounded-2xl border border-white/10 bg-[#17171d]">
          {photo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photo} alt="Bill photo" className="h-full w-full object-cover" />
          ) : (
            <video
              ref={videoRef}
              playsInline
              muted
              autoPlay
              className="h-full w-full object-cover"
            />
          )}
          <div className="pointer-events-none absolute left-3 top-3 h-8 w-8 rounded-tl-lg border-l-2 border-t-2 border-[#3B82F6]" />
          <div className="pointer-events-none absolute right-3 top-3 h-8 w-8 rounded-tr-lg border-r-2 border-t-2 border-[#3B82F6]" />
          <div className="pointer-events-none absolute bottom-3 left-3 h-8 w-8 rounded-bl-lg border-b-2 border-l-2 border-[#3B82F6]" />
          <div className="pointer-events-none absolute bottom-3 right-3 h-8 w-8 rounded-br-lg border-b-2 border-r-2 border-[#3B82F6]" />
        </div>

        {cameraError && !photo ? (
          <p className="mt-4 text-center text-[12.5px] leading-relaxed text-red-300">{cameraError}</p>
        ) : (
          <p className="mt-4 text-center text-[12.5px] leading-relaxed text-white/55">
            Point your camera at the bill, then tap the shutter. Gallery upload is not allowed.
          </p>
        )}

        <div className="mt-5 flex flex-col items-center gap-3">
          {!photo ? (
            <>
              <button
                type="button"
                onClick={capturePhoto}
                disabled={!cameraReady}
                className="h-[70px] w-[70px] rounded-full border-4 border-white/30 bg-white disabled:opacity-40"
                aria-label="Take photo"
              />
              {cameraError ? (
                <button
                  type="button"
                  onClick={startCamera}
                  className="text-sm font-semibold text-white/80 underline"
                >
                  Try camera again
                </button>
              ) : null}
            </>
          ) : (
            <button
              type="button"
              onClick={retake}
              className="rounded-2xl border border-white/25 px-5 py-2.5 text-sm font-semibold text-white"
            >
              Retake photo
            </button>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 rounded-[20px] bg-white p-4 shadow-[0_8px_20px_rgba(2,26,84,0.06)]">
        <div>
          <p className="text-sm font-bold text-[#0F172A]">Earn stamp</p>
          <p className="text-xs text-[#94A3B8]">{offerTitle}</p>
        </div>
        <span className="rounded-[100px] bg-[#EFF6FF] px-3 py-1.5 text-[11.5px] font-semibold text-[#3B82F6]">
          +1 Stamp
        </span>
      </div>

      <button
        type="button"
        disabled={busy || !photo}
        onClick={confirm}
        className="rounded-2xl bg-[#021A54] py-4 text-sm font-bold text-white hover:bg-[#0B2C6E] disabled:cursor-not-allowed disabled:opacity-50"
      >
        {busy ? 'Submitting…' : 'Submit photo & collect stamp'}
      </button>
    </div>
  );
}
