import React, { useState, useEffect, useRef } from 'react';
import {
  RotateCcw,
  Download,
  X,
  CheckCircle2,
  AlertCircle,
  PenTool,
  Eraser,
  Sparkles,
  ShieldCheck,
  Building2,
  Calendar,
  Phone,
  MapPin,
  FileText,
  BadgeCheck,
} from 'lucide-react';
import html2canvas from 'html2canvas-pro';
import jsPDF from 'jspdf';
import { Member, Refund } from '../types';
import { recordRefund } from '../services/firebaseService';
import {
  formatPKR,
  numberToWordsEnglish,
  numberToWordsUrdu,
} from '../utils/calculations';

interface RefundFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  member?: Member | null;
  currentUserEmail?: string;
  onRefundSuccess?: (refund: Refund) => void;
}

let cachedArabicFontBase64: string | null = null;

async function getEmbeddedArabicFontBase64(): Promise<string> {
  if (cachedArabicFontBase64) return cachedArabicFontBase64;
  try {
    const res = await fetch('/fonts/NotoNaskhArabic-Regular.ttf');
    if (!res.ok) return '';
    const arrayBuffer = await res.arrayBuffer();
    let binary = '';
    const bytes = new Uint8Array(arrayBuffer);
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    cachedArabicFontBase64 = window.btoa(binary);
    return cachedArabicFontBase64;
  } catch (e) {
    console.warn('Failed to load embedded Arabic/Urdu font for jsPDF:', e);
    return '';
  }
}

async function ensureUrduFontsLoaded(): Promise<void> {
  if (typeof window === 'undefined') return;
  if ('fonts' in document) {
    try {
      const fontFaces = [
        new FontFace('Noto Nastaliq Urdu', 'url(/fonts/NotoNastaliqUrdu-Regular.ttf)', { weight: '400' }),
        new FontFace('Noto Nastaliq Urdu', 'url(/fonts/NotoNastaliqUrdu-Regular.ttf)', { weight: '700' }),
        new FontFace('Noto Naskh Arabic', 'url(/fonts/NotoNaskhArabic-Regular.ttf)', { weight: '400' }),
        new FontFace('Noto Naskh Arabic', 'url(/fonts/NotoNaskhArabic-Regular.ttf)', { weight: '700' }),
      ];
      await Promise.all(
        fontFaces.map(async (f) => {
          try {
            const loaded = await f.load();
            document.fonts.add(loaded);
          } catch {
            // Already added or cached
          }
        })
      );
    } catch (err) {
      console.warn('FontFace registration error:', err);
    }
    await document.fonts.ready;
  }
}

export const RefundFormModal: React.FC<RefundFormModalProps> = ({
  isOpen,
  onClose,
  member,
  currentUserEmail = 'admin',
  onRefundSuccess,
}) => {
  // All inputs start empty as explicitly required by user
  const [voucherNumber, setVoucherNumber] = useState('');
  const [refundDate, setRefundDate] = useState('');

  // Member Identification (Empty by default)
  const [memberName, setMemberName] = useState('');
  const [fatherName, setFatherName] = useState('');
  const [cnic, setCnic] = useState('');
  const [memberNumber, setMemberNumber] = useState('');
  const [groupNumber, setGroupNumber] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [area, setArea] = useState('');

  // Salutation & Financials
  const [salutationName, setSalutationName] = useState('');
  const [salutationFather, setSalutationFather] = useState('');
  const [totalCollectedAmount, setTotalCollectedAmount] = useState('');
  const [amountInWordsEnglish, setAmountInWordsEnglish] = useState('');
  const [amountInWordsUrdu, setAmountInWordsUrdu] = useState('');
  const [receivedFigure, setReceivedFigure] = useState('');
  const [receivedWords, setReceivedWords] = useState('');

  // Refund description & reason
  const [qistDescription, setQistDescription] = useState('');
  const [refundReason, setRefundReason] = useState('');

  // Undertaking & Member Feedback
  const [memberFeedback, setMemberFeedback] = useState('');

  // Committee Summary
  const [registrationDate, setRegistrationDate] = useState('');
  const [committeePeriod, setCommitteePeriod] = useState('');
  const [monthlyInstallment, setMonthlyInstallment] = useState('');
  const [totalReceivedFigure, setTotalReceivedFigure] = useState('');
  const [totalRefundFigure, setTotalRefundFigure] = useState('');

  // Signatures
  const [issueDate, setIssueDate] = useState('');
  const [adminSignature, setAdminSignature] = useState('');
  const [memberSignature, setMemberSignature] = useState('');
  const [activeSignTarget, setActiveSignTarget] = useState<'admin' | 'member' | null>(null);

  // Status & Loaders
  const [isSaving, setIsSaving] = useState(false);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Signature canvas
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);

  // Form paper capture ref
  const formPrintRef = useRef<HTMLDivElement | null>(null);

  // Lock background body scroll when modal is open and automatically set initial Voucher # and Date
  useEffect(() => {
    if (isOpen) {
      const originalOverflow = document.body.style.overflow;
      const originalTouchAction = document.body.style.touchAction;
      document.body.style.overflow = 'hidden';
      document.body.style.touchAction = 'none';

      // Automatically generate Voucher # and Date as soon as the refund page/modal opens
      const now = new Date();
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const formattedDate = `${String(now.getDate()).padStart(2, '0')}-${months[now.getMonth()]}-${now.getFullYear()}`;
      const autoVoucher = `MZ-REF-${Date.now().toString().slice(-4)}`;

      setVoucherNumber((prev) => (prev ? prev : autoVoucher));
      setRefundDate((prev) => (prev ? prev : formattedDate));
      setIssueDate((prev) => (prev ? prev : formattedDate));

      return () => {
        document.body.style.overflow = originalOverflow;
        document.body.style.touchAction = originalTouchAction;
      };
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Auto-fill words helper when amount changes (Source of Truth for Urdu & English Words)
  const handleAmountChange = (val: string) => {
    setTotalCollectedAmount(val);
    setReceivedFigure(val);
    setTotalRefundFigure(val);
    const clean = val.replace(/,/g, '').trim();
    if (!clean) {
      setAmountInWordsEnglish('');
      setAmountInWordsUrdu('');
      setReceivedWords('');
      return;
    }
    const num = Number(clean);
    if (!isNaN(num)) {
      if (num === 0) {
        setAmountInWordsEnglish('Zero Only');
        const zeroUrdu = numberToWordsUrdu(0);
        setAmountInWordsUrdu(zeroUrdu);
        setReceivedWords(zeroUrdu);
      } else if (num > 0) {
        setAmountInWordsEnglish(numberToWordsEnglish(num));
        const urduWords = numberToWordsUrdu(num);
        setAmountInWordsUrdu(urduWords);
        setReceivedWords(urduWords);
      }
    }
  };

  const handleReceivedFigureChange = (val: string) => {
    setReceivedFigure(val);
    const clean = val.replace(/,/g, '').trim();
    if (!clean) {
      setReceivedWords('');
      return;
    }
    const num = Number(clean);
    if (!isNaN(num)) {
      setReceivedWords(numberToWordsUrdu(num));
    }
  };

  // Quick fill from member details for admin convenience
  const handleAutofillFromMember = () => {
    const now = new Date();
    const formattedDate = `${String(now.getDate()).padStart(2, '0')}-${now.toLocaleString('default', { month: 'short' })}-${now.getFullYear()}`;
    const autoVoucher = `MZ-REF-${Date.now().toString().slice(-4)}`;

    setVoucherNumber(autoVoucher);
    setRefundDate(formattedDate);
    setMemberName(member?.fullName || 'محمد طلحہ خان');
    setFatherName(member?.fatherName || 'عبد الرحمٰن');
    setCnic(member?.cnic || '42401-8976543-1');
    setMemberNumber(member?.memberNumber || '#FGN-085');
    setGroupNumber(member?.groupNumber || (member ? `#GRP-${member.memberNumber.replace(/\D/g, '')}` : '#GRP-085'));
    setPhone(member?.mobile || '0321-8924033');
    setAddress(member?.address || 'House No. 37, Block 7, Clifton, Karachi');
    setArea('کراچی / Karachi');

    setSalutationName(member?.fullName || 'محمد طلحہ خان');
    setSalutationFather(member?.fatherName || 'عبد الرحمٰن');

    const amt = member && member.paidAmount > 0 ? String(member.paidAmount) : '120000';
    handleAmountChange(amt);

    setQistDescription(`قسط نمبر 1 تا ${member?.planMonths || 24} (مکمل امانت شدہ رقم کی واپسی)`);
    setRefundReason('Member request / Committee plan cancellation voucher');
    setMemberFeedback('انتظامیہ کے احسن سلوک اور بروقت امانت کی واپسی پر مکمل مطمئن ہوں۔');

    setRegistrationDate(member?.createdAt ? member.createdAt.split('T')[0] : '01-Jan-2027');
    setCommitteePeriod(`${member?.planMonths || 24} ماہ (Months)`);
    setMonthlyInstallment(String(member?.monthlyInstallment || 5000));
    setTotalReceivedFigure(amt);
    setTotalRefundFigure(amt);
    setIssueDate(formattedDate);
    setAdminSignature('Abdul Shakoor Madni (Admin)');
    setStatusMessage({ type: 'success', text: 'Form Auto-filled with member details successfully.' });
  };

  // Clear all fields
  const handleClearAll = () => {
    setVoucherNumber('');
    setRefundDate('');
    setMemberName('');
    setFatherName('');
    setCnic('');
    setMemberNumber('');
    setGroupNumber('');
    setPhone('');
    setAddress('');
    setArea('');
    setSalutationName('');
    setSalutationFather('');
    setTotalCollectedAmount('');
    setAmountInWordsEnglish('');
    setAmountInWordsUrdu('');
    setReceivedFigure('');
    setReceivedWords('');
    setQistDescription('');
    setRefundReason('');
    setMemberFeedback('');
    setRegistrationDate('');
    setCommitteePeriod('');
    setMonthlyInstallment('');
    setTotalReceivedFigure('');
    setTotalRefundFigure('');
    setIssueDate('');
    setAdminSignature('');
    setMemberSignature('');
  };

  // Canvas Drawing Handlers
  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    setIsDrawing(true);
    const rect = canvas.getBoundingClientRect();
    const x = 'touches' in e ? e.touches[0].clientX - rect.left : e.clientX - rect.left;
    const y = 'touches' in e ? e.touches[0].clientY - rect.top : e.clientY - rect.top;
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    const x = 'touches' in e ? e.touches[0].clientX - rect.left : e.clientX - rect.left;
    const y = 'touches' in e ? e.touches[0].clientY - rect.top : e.clientY - rect.top;
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#064E3B';
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  const saveCanvasSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL('image/png');
    if (activeSignTarget === 'admin') {
      setAdminSignature(dataUrl);
    } else if (activeSignTarget === 'member') {
      setMemberSignature(dataUrl);
    }
    setActiveSignTarget(null);
  };

  // Download PDF Form with complex-script Urdu shaping & embedded font support
  const handleDownloadPDF = async () => {
    if (!formPrintRef.current) return;
    try {
      setIsDownloadingPdf(true);
      setStatusMessage({ type: 'success', text: 'Generating A4 PDF voucher...' });

      const element = formPrintRef.current;

      // Ensure printable container has dynamic height and overflow visible during export
      const originalHeight = element.style.height;
      const originalOverflow = element.style.overflow;
      const originalMaxHeight = element.style.maxHeight;

      element.style.height = 'auto';
      element.style.overflow = 'visible';
      element.style.maxHeight = 'none';

      // 1. Ensure all custom fonts (especially Noto Nastaliq Urdu & Noto Naskh Arabic) are loaded
      await ensureUrduFontsLoaded();

      // 2. Fetch base64 of embedded Unicode font for jsPDF VFS
      const embeddedFontBase64 = await getEmbeddedArabicFontBase64();

      // 3. Collect field coordinates relative to the container for the selectable text layer
      const elementRect = element.getBoundingClientRect();
      interface SelectableField {
        val: string;
        isUrdu: boolean;
        relX: number;
        relY: number;
        relW: number;
        relH: number;
        fontSize: number;
        textAlign: string;
      }
      const selectableFields: SelectableField[] = [];
      const liveInputs = element.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('input, textarea');

      liveInputs.forEach((liveInput) => {
        const val = liveInput.value?.trim() || '';
        if (val) {
          const rect = liveInput.getBoundingClientRect();
          const comp = window.getComputedStyle(liveInput);
          const hasUrdu = /[\u0600-\u06FF\u0750-\u077F\uFB50-\uFDFF\uFE70-\uFEFF]/.test(val);
          selectableFields.push({
            val: liveInput.value,
            isUrdu: hasUrdu,
            relX: (rect.left - elementRect.left) / Math.max(1, elementRect.width),
            relY: (rect.top - elementRect.top) / Math.max(1, elementRect.height),
            relW: rect.width / Math.max(1, elementRect.width),
            relH: rect.height / Math.max(1, elementRect.height),
            fontSize: parseFloat(comp.fontSize) || 11,
            textAlign: comp.textAlign || (hasUrdu ? 'right' : 'left'),
          });
        }
      });

      const cleanVoucher = (voucherNumber || memberNumber || memberName || 'Voucher').replace(/[^a-zA-Z0-9_-]/g, '_');
      const filename = `MZA-Refund-Voucher-${cleanVoucher}.pdf`;

      try {
        const canvas = await html2canvas(element, {
          scale: 2,
          scrollY: 0,
          useCORS: true,
          windowWidth: 1200,
          backgroundColor: '#ffffff',
          logging: false,
          onclone: async (clonedDoc, clonedElement) => {
            // A. Inject @font-face rules into cloned iframe document head
            const styleEl = clonedDoc.createElement('style');
            styleEl.textContent = `
              @font-face {
                font-family: 'Noto Nastaliq Urdu';
                src: url('/fonts/NotoNastaliqUrdu-Regular.ttf') format('truetype');
                font-weight: 400;
                font-style: normal;
              }
              @font-face {
                font-family: 'Noto Nastaliq Urdu';
                src: url('/fonts/NotoNastaliqUrdu-Regular.ttf') format('truetype');
                font-weight: 700;
                font-style: normal;
              }
              @font-face {
                font-family: 'Noto Naskh Arabic';
                src: url('/fonts/NotoNaskhArabic-Regular.ttf') format('truetype');
                font-weight: 400;
                font-style: normal;
              }
              @font-face {
                font-family: 'Noto Naskh Arabic';
                src: url('/fonts/NotoNaskhArabic-Regular.ttf') format('truetype');
                font-weight: 700;
                font-style: normal;
              }
              .cloned-form-field-replacement {
                box-sizing: border-box !important;
                letter-spacing: 0 !important;
                word-break: break-word !important;
              }
            `;
            clonedDoc.head.appendChild(styleEl);

            if (clonedDoc.fonts) {
              try {
                await clonedDoc.fonts.ready;
              } catch {
                // Continue if already ready
              }
            }

            // B. Replace inputs and textareas in the cloned DOM with block-level styled elements.
            // Using display: block with direction: rtl and text-align: right guarantees that
            // html2canvas-pro anchors text ranges solidly to the right border with comfortable 14px padding.
            const clonedInputs = clonedElement.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('input, textarea');
            const sourceInputs = element.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('input, textarea');

            for (let i = 0; i < clonedInputs.length; i++) {
              const clonedInput = clonedInputs[i];
              const sourceInput = sourceInputs[i];
              if (!clonedInput || !sourceInput) continue;

              const val = sourceInput.value ?? '';
              const isTextarea = sourceInput.tagName.toLowerCase() === 'textarea';
              const computed = window.getComputedStyle(sourceInput);

              const replacement = clonedDoc.createElement('div');
              replacement.className = `${sourceInput.className} cloned-form-field-replacement`;

              // Copy exact dimensions from live rendered input to ensure 0 layout shift
              const widthPx = sourceInput.offsetWidth > 0 ? sourceInput.offsetWidth : parseFloat(computed.width);
              const heightPx = sourceInput.offsetHeight > 0 ? sourceInput.offsetHeight : parseFloat(computed.height);

              replacement.style.boxSizing = 'border-box';
              replacement.style.width = `${widthPx}px`;
              replacement.style.display = 'block';

              // Copy live computed colors, borders, typography
              replacement.style.margin = computed.margin;
              replacement.style.border = computed.border;
              replacement.style.borderRadius = computed.borderRadius;
              replacement.style.backgroundColor = computed.backgroundColor;
              replacement.style.color = computed.color;
              replacement.style.fontSize = computed.fontSize;
              replacement.style.fontWeight = computed.fontWeight;

              // Script and direction detection
              const hasUrdu = /[\u0600-\u06FF\u0750-\u077F\uFB50-\uFDFF\uFE70-\uFEFF]/.test(val);
              const isRtl = sourceInput.getAttribute('dir') === 'rtl' ||
                            sourceInput.classList.contains('text-right') ||
                            computed.direction === 'rtl' ||
                            computed.textAlign === 'right' ||
                            hasUrdu;
              const isCenter = sourceInput.classList.contains('text-center') || computed.textAlign === 'center';

              if (isRtl) {
                replacement.setAttribute('dir', 'rtl');
                replacement.style.direction = 'rtl';
                replacement.style.textAlign = 'right';
                // Comfortable right padding between 12px and 16px (14px)
                replacement.style.paddingRight = '14px';
                replacement.style.paddingLeft = '8px';
              } else if (isCenter) {
                replacement.setAttribute('dir', 'ltr');
                replacement.style.direction = 'ltr';
                replacement.style.textAlign = 'center';
                replacement.style.paddingLeft = '6px';
                replacement.style.paddingRight = '6px';
              } else {
                replacement.setAttribute('dir', 'ltr');
                replacement.style.direction = 'ltr';
                replacement.style.textAlign = 'left';
                replacement.style.paddingLeft = '10px';
                replacement.style.paddingRight = '8px';
              }

              if (isTextarea) {
                replacement.style.minHeight = `${heightPx}px`;
                replacement.style.paddingTop = computed.paddingTop || '6px';
                replacement.style.paddingBottom = computed.paddingBottom || '6px';
                replacement.style.whiteSpace = 'pre-wrap';
                replacement.style.wordBreak = 'break-word';
                replacement.style.lineHeight = computed.lineHeight || '1.6';
              } else {
                replacement.style.height = `${heightPx}px`;
                replacement.style.paddingTop = '0px';
                replacement.style.paddingBottom = '0px';
                replacement.style.whiteSpace = 'nowrap';
                replacement.style.overflow = 'hidden';
                replacement.style.textOverflow = 'ellipsis';
                // Vertical alignment matching input height
                const borderTop = parseFloat(computed.borderTopWidth) || 1;
                const borderBottom = parseFloat(computed.borderBottomWidth) || 1;
                const innerH = Math.max(14, heightPx - borderTop - borderBottom - 2);
                replacement.style.lineHeight = `${innerH}px`;
              }

              // Prioritize embedded Urdu/Arabic Unicode fonts with fallback
              replacement.style.fontFamily = `'Noto Nastaliq Urdu', 'Noto Naskh Arabic', 'Noto Sans Arabic', ${computed.fontFamily}`;
              replacement.style.letterSpacing = '0px';

              if (val.trim()) {
                replacement.textContent = val.trim();
              } else {
                // Empty inputs remain clean with original border/background without collapsing
                replacement.innerHTML = '&nbsp;';
                replacement.style.color = 'transparent';
              }

              clonedInput.parentNode?.replaceChild(replacement, clonedInput);
            }
          },
        });

        const imgData = canvas.toDataURL('image/jpeg', 0.98);
        const pdf = new jsPDF({
          orientation: 'portrait',
          unit: 'mm',
          format: 'a4',
        });

        // Embed Unicode Urdu/Arabic font into jsPDF VFS for standalone portability
        if (embeddedFontBase64) {
          try {
            pdf.addFileToVFS('NotoNaskhArabic.ttf', embeddedFontBase64);
            pdf.addFont('NotoNaskhArabic.ttf', 'NotoNaskhArabic', 'normal');
          } catch (fontErr) {
            console.warn('jsPDF font registration notice:', fontErr);
          }
        }

        const pageWidth = pdf.internal.pageSize.getWidth();
        const pageHeight = pdf.internal.pageSize.getHeight();
        const margin = 5;
        const printW = pageWidth - margin * 2;
        const printH = pageHeight - margin * 2;
        const scale = Math.min(printW / canvas.width, printH / canvas.height);
        const renderW = canvas.width * scale;
        const renderH = canvas.height * scale;
        const xOffset = margin + (printW - renderW) / 2;
        const yOffset = margin + (printH - renderH) / 2;

        // Visual high-resolution render preserving full Nastaliq cursive typography, signatures, and badges
        pdf.addImage(imgData, 'JPEG', xOffset, yOffset, renderW, renderH, undefined, 'FAST');

        // Embed real selectable Unicode text layer for all filled fields (Requirement 9)
        if (selectableFields.length > 0) {
          try {
            if (embeddedFontBase64) {
              pdf.setFont('NotoNaskhArabic', 'normal');
            }
            selectableFields.forEach((field) => {
              const pdfFieldX = xOffset + field.relX * renderW;
              const pdfFieldY = yOffset + field.relY * renderH;
              const pdfFieldW = field.relW * renderW;
              const pdfFieldH = field.relH * renderH;
              // Right padding offset in PDF mm (~2.5mm corresponds to ~14px right padding on canvas)
              const textX = field.textAlign === 'right' || field.isUrdu ? (pdfFieldX + pdfFieldW - 2.5) : (pdfFieldX + 1.5);
              const textY = pdfFieldY + pdfFieldH * 0.7;

              pdf.text(field.val, textX, textY, {
                align: field.textAlign === 'right' || field.isUrdu ? 'right' : 'left',
                renderingMode: 'invisible',
                maxWidth: Math.max(10, pdfFieldW - 4),
              });
            });
          } catch (txtErr) {
            console.warn('Selectable text layer note:', txtErr);
          }
        }

        pdf.save(filename);
      } finally {
        // Restore container styles
        element.style.height = originalHeight;
        element.style.overflow = originalOverflow;
        element.style.maxHeight = originalMaxHeight;
      }

      setStatusMessage({ type: 'success', text: `PDF Downloaded: ${filename} (A4 Official Page)` });
    } catch (err: any) {
      console.error('PDF generation error:', err);
      setStatusMessage({ type: 'error', text: 'PDF generate nahi ho saka. Baraye mehrbani dubara koshish karein.' });
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  // Save Record into Firestore
  const handleSaveRecord = async () => {
    if (!member && !memberName) {
      setStatusMessage({ type: 'error', text: 'Baraye mehrbani Member Name ya Member darj karein.' });
      return;
    }

    const numAmt = Number(totalCollectedAmount) || Number(totalRefundFigure) || (member ? member.paidAmount : 0);
    if (numAmt <= 0) {
      setStatusMessage({ type: 'error', text: 'Baraye mehrbani Refund Amount darj karein.' });
      return;
    }

    try {
      setIsSaving(true);
      setStatusMessage(null);

      const targetMemberId = member ? member.id : `member_${Date.now()}`;
      const voucher = voucherNumber.trim() || `MZ-REF-${Date.now().toString().slice(-4)}`;

      const createdRefund = await recordRefund({
        memberId: targetMemberId,
        memberNumber: memberNumber || (member ? member.memberNumber : 'MZ-REF'),
        memberName: memberName || (member ? member.fullName : 'Valued Member'),
        fatherName: fatherName || (member ? member.fatherName : ''),
        cnic: cnic || (member ? member.cnic : ''),
        phone: phone || (member ? member.mobile : ''),
        groupNumber: groupNumber || '',
        address: address || '',
        area: area || '',
        refundAmount: numAmt,
        refundAmountInWordsEnglish: amountInWordsEnglish || '',
        refundAmountInWordsUrdu: amountInWordsUrdu || '',
        installmentsDescription: qistDescription || '',
        memberFeedback: memberFeedback || '',
        refundDate: refundDate || new Date().toISOString().split('T')[0],
        reason: refundReason || `Refund Voucher #${voucher} - ${qistDescription || 'Official Refund'}`,
        approvedBy: currentUserEmail || 'Admin',
        adminSignature: adminSignature.length > 50 ? 'Signed Digitally' : adminSignature,
        memberSignature: memberSignature.length > 50 ? 'Signed Digitally' : memberSignature,
        notes: `Refund Form #${voucher}. Details: ${qistDescription}. Member Feedback: ${memberFeedback}`,
        refundVoucherNumber: voucher,
      }, currentUserEmail);

      setStatusMessage({ type: 'success', text: 'Refund record kamyabi se database me save ho gaya!' });
      if (onRefundSuccess) {
        onRefundSuccess(createdRefund);
      }
    } catch (err: any) {
      console.error('Error saving refund record:', err);
      setStatusMessage({ type: 'error', text: err?.message || 'Record save karne me masla pesh aya.' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveAndDownload = async () => {
    await handleSaveRecord();
    await handleDownloadPDF();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/50 backdrop-blur-xs overflow-hidden">
      <div className="relative bg-slate-100 rounded-2xl sm:rounded-3xl shadow-2xl border border-slate-300 w-full max-w-5xl my-auto overflow-hidden flex flex-col h-[94vh] max-h-[96vh]">
        
        {/* Top Control Bar aligned with App's Theme */}
        <div className="w-full bg-[#064E3B] text-white px-3.5 sm:px-5 py-3 flex items-center justify-between gap-2.5 shrink-0 border-b border-emerald-950 shadow-sm">
          <div className="flex items-center gap-2.5 min-w-0">
            <button
              type="button"
              onClick={handleClearAll}
              className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-white/10 hover:bg-white/20 text-emerald-200 hover:text-white border border-white/15 flex items-center justify-center font-bold shrink-0 transition-colors cursor-pointer"
              title="Reset / Clear all fields"
            >
              <RotateCcw className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
            <div className="min-w-0">
              <h2 className="text-sm sm:text-base font-bold text-white tracking-tight flex items-center gap-2 truncate">
                <span>فارم واپسی رقم (Refund Voucher)</span>
                <span className="text-[10px] uppercase tracking-wider bg-emerald-800/90 border border-emerald-700/60 px-2 py-0.5 rounded-md text-emerald-200 font-semibold shrink-0">
                  Official Portal
                </span>
              </h2>
              <p className="text-[11px] sm:text-xs text-emerald-100/70 truncate hidden sm:block">
                Professional Form with Urdu Nastaliq Typography & PDF Export.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Autofill Button */}
            <button
              type="button"
              onClick={handleAutofillFromMember}
              className="px-2.5 sm:px-3 py-1.5 bg-emerald-800 hover:bg-emerald-700 active:scale-98 text-emerald-100 border border-emerald-700/60 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Auto-fill with member details"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              <span>Auto-fill</span>
            </button>

            <button
              type="button"
              onClick={handleClearAll}
              className="px-2.5 sm:px-3 py-1.5 bg-emerald-900/80 hover:bg-emerald-800 text-emerald-200 hover:text-white rounded-xl text-xs font-semibold transition-colors cursor-pointer border border-emerald-700/60"
              title="Clear all fields"
            >
              Clear
            </button>

            <button
              type="button"
              disabled={isDownloadingPdf}
              onClick={handleDownloadPDF}
              className="px-3 sm:px-3.5 py-1.5 bg-amber-500 hover:bg-amber-400 active:scale-98 text-emerald-950 font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-xs transition-all cursor-pointer disabled:opacity-50"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{isDownloadingPdf ? 'Generating...' : 'Download PDF'}</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-1 sm:p-1.5 text-emerald-200 hover:text-white hover:bg-emerald-900 rounded-xl transition-colors cursor-pointer"
              title="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Status Notification Banner */}
        {statusMessage && (
          <div
            className={`px-4 sm:px-5 py-2 sm:py-2.5 text-xs font-semibold flex items-center justify-between shrink-0 ${
              statusMessage.type === 'success'
                ? 'bg-emerald-100 text-emerald-900 border-b border-emerald-200'
                : 'bg-rose-100 text-rose-900 border-b border-rose-200'
            }`}
          >
            <div className="flex items-center gap-2">
              {statusMessage.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-700 shrink-0" />
              )}
              <span>{statusMessage.text}</span>
            </div>
            <button
              onClick={() => setStatusMessage(null)}
              className="text-xs font-bold underline cursor-pointer ml-2"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Form Container (Scrollable canvas viewport) */}
        <div className="w-full flex-1 overflow-y-auto overscroll-contain p-2 sm:p-4 md:p-6 bg-slate-100 flex justify-center items-start">
          
          {/* PROFESSIONAL REFUND FORM CARD */}
          <div
            ref={formPrintRef}
            id="pdf-voucher-container"
            className="w-full max-w-[850px] mx-auto bg-white border border-slate-300 rounded-xl sm:rounded-2xl shadow-xl p-3.5 sm:p-5 md:p-6 text-slate-900 leading-normal relative font-sans print:shadow-none print:border-none print:m-0 print:p-6"
            style={{ height: 'auto', overflow: 'visible' }}
          >
            {/* Top Ornamental Header Band */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between border-b-2 border-emerald-800/80 pb-3 sm:pb-4 mb-3 sm:mb-4 gap-3 sm:gap-4">
              {/* Left Brand Identity */}
              <div className="flex items-center gap-2.5 sm:gap-3.5 min-w-0 flex-1">
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-[#064E3B] text-amber-400 flex items-center justify-center font-bold shadow-md shadow-emerald-950/10 shrink-0">
                  <ShieldCheck className="w-6 h-6 sm:w-7 sm:h-7" />
                </div>
                <div className="min-w-0">
                  <h1 className="text-base sm:text-xl md:text-2xl font-black text-[#064E3B] tracking-tight uppercase leading-tight truncate sm:whitespace-normal">
                    M.Z.A UMRAH COMMITTEE
                  </h1>
                  <p className="text-[10.5px] sm:text-xs font-bold text-slate-600 leading-tight mt-0.5 truncate sm:whitespace-normal">
                    Under the supervision of M.Z.A Welfare Pakistan
                  </p>
                  <span className="text-[9px] sm:text-[10px] font-semibold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200/60 mt-1 inline-block">
                    Established in 2019 • Regd. Welfare Trust
                  </span>
                </div>
              </div>

              {/* Right Metadata Block: Receipt No & Refund Date */}
              <div className="w-full sm:w-auto flex flex-col sm:flex-row md:flex-col items-stretch sm:items-center md:items-end justify-between sm:justify-end gap-2 bg-slate-50/90 border border-slate-200 p-2 sm:p-2.5 rounded-xl text-xs shrink-0 shadow-2xs">
                <div className="flex items-center justify-between sm:justify-end gap-2 w-full sm:w-auto">
                  <span className="font-bold text-slate-700 text-[11px] sm:text-xs shrink-0">Voucher #:</span>
                  <input
                    type="text"
                    value={voucherNumber}
                    onChange={(e) => setVoucherNumber(e.target.value)}
                    placeholder="#MZ-REF-0079"
                    dir="ltr"
                    className="w-28 sm:w-32 px-2 py-1 font-mono font-bold text-xs text-rose-700 border border-slate-300 rounded-md bg-white focus:outline-hidden focus:border-emerald-600 text-center shadow-2xs"
                  />
                </div>
                <div className="flex items-center justify-between sm:justify-end gap-2 w-full sm:w-auto">
                  <span className="font-bold text-slate-700 text-[11px] sm:text-xs shrink-0">Date:</span>
                  <input
                    type="text"
                    value={refundDate}
                    onChange={(e) => setRefundDate(e.target.value)}
                    placeholder="DD-MMM-YYYY"
                    dir="ltr"
                    className="w-28 sm:w-32 px-2 py-1 font-semibold text-xs text-slate-900 border border-slate-300 rounded-md bg-white focus:outline-hidden focus:border-emerald-600 text-center shadow-2xs"
                  />
                </div>
              </div>
            </div>

            {/* Document Title Banner */}
            <div className="text-center my-2.5 sm:my-3 py-1.5 px-3 bg-gradient-to-r from-emerald-900 via-[#064E3B] to-emerald-900 text-white rounded-xl shadow-xs">
              <h2 className="text-base sm:text-lg font-bold font-nastaliq text-amber-300 tracking-wide" dir="rtl">
                فارم واپسی رقم (برائے ممبر)
              </h2>
              <p className="text-[10px] sm:text-[11px] font-semibold text-emerald-100 tracking-widest uppercase mt-0.5">
                Official Committee Refund Voucher & Settlement Accord
              </p>
            </div>

            {/* SECTION 1: کوائف برائے ممبر (Member Bio-Data & Info) */}
            <div className="mt-2.5 sm:mt-3 bg-slate-50/80 border border-slate-200/90 rounded-xl p-2.5 sm:p-3">
              <div className="flex items-center justify-between border-b border-slate-200 pb-1 mb-2">
                <span className="text-[10px] sm:text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  Section 01 • Member Identification
                </span>
                <span className="text-xs sm:text-sm font-bold font-nastaliq text-[#064E3B]" dir="rtl">
                  ( کوائف برائے ممبر )
                </span>
              </div>

              {/* Grid of Inputs with Urdu Nastaliq & English Subtitle */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 sm:gap-2.5 text-xs">
                {/* 1. نام ممبر */}
                <div>
                  <label className="block text-right font-bold text-slate-800 mb-0.5 font-nastaliq-tight text-xs" dir="rtl">
                    نام ممبر: <span className="text-[10px] font-sans font-normal text-slate-500">(Member Name)</span>
                  </label>
                  <input
                    type="text"
                    value={memberName}
                    onChange={(e) => {
                      setMemberName(e.target.value);
                      setSalutationName(e.target.value);
                    }}
                    placeholder="ممبر کا مکمل نام..."
                    className="w-full pr-3.5 pl-2.5 py-1 text-slate-900 font-semibold border border-slate-300 rounded-lg bg-white focus:outline-hidden focus:border-emerald-600 text-right font-nastaliq-tight text-xs"
                    dir="rtl"
                  />
                </div>

                {/* 2. ولدیت */}
                <div>
                  <label className="block text-right font-bold text-slate-800 mb-0.5 font-nastaliq-tight text-xs" dir="rtl">
                    ولد / زوجہ: <span className="text-[10px] font-sans font-normal text-slate-500">(Father / Husband)</span>
                  </label>
                  <input
                    type="text"
                    value={fatherName}
                    onChange={(e) => {
                      setFatherName(e.target.value);
                      setSalutationFather(e.target.value);
                    }}
                    placeholder="والد یا شوہر کا نام..."
                    className="w-full pr-3.5 pl-2.5 py-1 text-slate-900 font-semibold border border-slate-300 rounded-lg bg-white focus:outline-hidden focus:border-emerald-600 text-right font-nastaliq-tight text-xs"
                    dir="rtl"
                  />
                </div>

                {/* 3. شناختی کارڈ نمبر */}
                <div>
                  <label className="block text-right font-bold text-slate-800 mb-0.5 font-nastaliq-tight text-xs" dir="rtl">
                    شناختی کارڈ نمبر: <span className="text-[10px] font-sans font-normal text-slate-500">(CNIC Number)</span>
                  </label>
                  <input
                    type="text"
                    value={cnic}
                    onChange={(e) => setCnic(e.target.value)}
                    placeholder="42401-XXXXXXX-X"
                    dir="ltr"
                    className="w-full px-2 py-1 text-slate-900 font-mono font-medium border border-slate-300 rounded-lg bg-white focus:outline-hidden focus:border-emerald-600 text-center text-xs"
                  />
                </div>

                {/* 4. ممبر شپ نمبر */}
                <div>
                  <label className="block text-right font-bold text-slate-800 mb-0.5 font-nastaliq-tight text-xs" dir="rtl">
                    ممبر شپ نمبر: <span className="text-[10px] font-sans font-normal text-slate-500">(Membership #)</span>
                  </label>
                  <input
                    type="text"
                    value={memberNumber}
                    onChange={(e) => setMemberNumber(e.target.value)}
                    placeholder="#FGN-085"
                    dir="ltr"
                    className="w-full px-2 py-1 text-rose-700 font-bold font-mono border border-slate-300 rounded-lg bg-white focus:outline-hidden focus:border-emerald-600 text-center text-xs"
                  />
                </div>

                {/* 5. گروپ نمبر */}
                <div>
                  <label className="block text-right font-bold text-slate-800 mb-0.5 font-nastaliq-tight text-xs" dir="rtl">
                    گروپ نمبر: <span className="text-[10px] font-sans font-normal text-slate-500">(Group #)</span>
                  </label>
                  <input
                    type="text"
                    value={groupNumber}
                    onChange={(e) => setGroupNumber(e.target.value)}
                    placeholder="#FGN-078"
                    dir="ltr"
                    className="w-full px-2 py-1 text-slate-800 font-bold font-mono border border-slate-300 rounded-lg bg-white focus:outline-hidden focus:border-emerald-600 text-center text-xs"
                  />
                </div>

                {/* 6. فون نمبر */}
                <div>
                  <label className="block text-right font-bold text-slate-800 mb-0.5 font-nastaliq-tight text-xs" dir="rtl">
                    فون نمبر: <span className="text-[10px] font-sans font-normal text-slate-500">(Contact / Mobile)</span>
                  </label>
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="0300XXXXXXX"
                    dir="ltr"
                    className="w-full px-2 py-1 text-slate-900 font-mono font-medium border border-slate-300 rounded-lg bg-white focus:outline-hidden focus:border-emerald-600 text-center text-xs"
                  />
                </div>

                {/* 7. رہائشی پتہ */}
                <div className="sm:col-span-2">
                  <label className="block text-right font-bold text-slate-800 mb-0.5 font-nastaliq-tight text-xs" dir="rtl">
                    مکان نمبر و رہائشی پتہ: <span className="text-[10px] font-sans font-normal text-slate-500">(Residential Address)</span>
                  </label>
                  <input
                    type="text"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="مکان نمبر، بلاک، گلی، کالونی، شہر..."
                    className="w-full pr-3.5 pl-2.5 py-1 text-slate-900 border border-slate-300 rounded-lg bg-white focus:outline-hidden focus:border-emerald-600 text-right font-nastaliq-tight text-xs"
                    dir="rtl"
                  />
                </div>

                {/* 8. علاقہ */}
                <div>
                  <label className="block text-right font-bold text-slate-800 mb-0.5 font-nastaliq-tight text-xs" dir="rtl">
                    علاقہ / تحصیل: <span className="text-[10px] font-sans font-normal text-slate-500">(Area / Town)</span>
                  </label>
                  <input
                    type="text"
                    value={area}
                    onChange={(e) => setArea(e.target.value)}
                    placeholder="علاقہ مثلاً گلشن بہار، اورنگی..."
                    className="w-full pr-3.5 pl-2.5 py-1 text-slate-900 border border-slate-300 rounded-lg bg-white focus:outline-hidden focus:border-emerald-600 text-right font-nastaliq-tight text-xs"
                    dir="rtl"
                  />
                </div>
              </div>
            </div>

            {/* SECTION 2: مالیاتی تفصیلات و تصدیق واپسی (Financials & Settlement) */}
            <div className="mt-2.5 sm:mt-3 border border-emerald-900/20 bg-emerald-50/40 rounded-xl p-2.5 sm:p-3 space-y-2">
              <div className="flex items-center justify-between border-b border-emerald-900/15 pb-1">
                <span className="text-[10px] sm:text-[11px] font-bold text-emerald-900 uppercase tracking-wider">
                  Section 02 • Financial Details & Settlement
                </span>
                <span className="text-xs sm:text-sm font-bold font-nastaliq text-[#064E3B]" dir="rtl">
                  ( مالیاتی تفصیلات و تصدیق رقم )
                </span>
              </div>

              {/* Salutation Box */}
              <div className="flex flex-wrap items-center justify-end gap-1.5 sm:gap-2 text-xs font-nastaliq text-slate-900 leading-normal" dir="rtl">
                <span className="font-bold text-[#064E3B]">محترم جناب:</span>
                <input
                  type="text"
                  value={salutationName}
                  onChange={(e) => setSalutationName(e.target.value)}
                  placeholder="نام محترم..."
                  dir="rtl"
                  className="pr-3.5 pl-2 py-0.5 border-b-2 border-emerald-800 font-bold text-rose-700 bg-white/80 rounded-md focus:outline-hidden min-w-[100px] sm:min-w-[130px] flex-1 sm:flex-initial text-right text-xs"
                />
                <span className="font-bold text-[#064E3B]">ولد:</span>
                <input
                  type="text"
                  value={salutationFather}
                  onChange={(e) => setSalutationFather(e.target.value)}
                  placeholder="والد کا نام..."
                  dir="rtl"
                  className="pr-3.5 pl-2 py-0.5 border-b-2 border-emerald-800 font-bold text-rose-700 bg-white/80 rounded-md focus:outline-hidden min-w-[100px] sm:min-w-[130px] flex-1 sm:flex-initial text-right text-xs"
                />
                <span className="font-bold text-[#064E3B]">صاحب —</span>
                <span className="font-bold text-emerald-900 mr-auto text-xs">السلام علیکم ورحمۃ اللہ وبرکاتہ</span>
              </div>

              {/* Amount Statement in Figures & Words */}
              <div className="bg-white p-2 sm:p-2.5 rounded-xl border border-emerald-200/80 shadow-xs space-y-2" dir="rtl">
                <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 text-xs font-nastaliq text-slate-900">
                  <span className="font-bold text-[#064E3B]">آپ کی عمرہ کمیٹی میں جمع ہونے والی کل رقم:</span>
                  <div className="flex items-center gap-1.5" dir="ltr">
                    <span className="font-bold text-slate-700 text-xs">PKR</span>
                    <input
                      type="text"
                      value={totalCollectedAmount}
                      onChange={(e) => handleAmountChange(e.target.value)}
                      placeholder="120,000"
                      className="w-24 sm:w-28 px-2 py-0.5 font-mono font-black text-slate-950 border-2 border-emerald-700 rounded-lg text-center focus:outline-hidden bg-emerald-50/50 text-xs"
                    />
                  </div>
                </div>

                {/* Amount in English and Urdu Words */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs" dir="ltr">
                  <div>
                    <label className="block text-slate-600 font-semibold mb-0.5 text-[10px] sm:text-[11px]">
                      Amount in Words (English):
                    </label>
                    <input
                      type="text"
                      value={amountInWordsEnglish}
                      onChange={(e) => setAmountInWordsEnglish(e.target.value)}
                      placeholder="One Hundred Twenty Thousand Rupees Only"
                      className="w-full px-2 py-0.5 font-medium border border-slate-300 rounded-lg bg-slate-50 focus:outline-hidden focus:border-emerald-600 text-xs text-rose-700 font-semibold"
                    />
                  </div>
                  <div dir="rtl">
                    <label className="block text-right text-slate-700 font-bold mb-0.5 font-nastaliq-tight text-xs">
                      رقم بلحاظ الفاظ:
                    </label>
                    <input
                      type="text"
                      value={amountInWordsUrdu}
                      onChange={(e) => setAmountInWordsUrdu(e.target.value)}
                      placeholder="ایک لاکھ بیس ہزار"
                      dir="rtl"
                      className="w-full pr-3.5 pl-2.5 py-1 font-bold font-nastaliq border border-slate-300 rounded-lg bg-slate-50 focus:outline-hidden focus:border-emerald-600 text-xs text-rose-700 text-right"
                    />
                  </div>
                </div>

                {/* Confirmation Inquiry & Member Acceptance */}
                <div className="pt-1 border-t border-slate-200 text-xs font-nastaliq text-slate-800 space-y-1">
                  <p className="leading-normal text-xs">
                    عمرہ کمیٹی کی انتظامیہ نے آپ کی امانت کی رقم آپ کو واپس کر دی ہے۔ کیا آپ مطمئن ہیں اور اس رقم کی واپسی کی تصدیق کرتے ہیں؟
                  </p>
                  <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 pt-0.5 font-nastaliq text-slate-900 bg-emerald-50/60 p-1.5 sm:p-2 rounded-lg border border-emerald-200/60 text-xs">
                    <span className="font-bold text-[#064E3B]">جی ہاں! میں نے</span>
                    <input
                      type="text"
                      value={receivedFigure}
                      onChange={(e) => handleReceivedFigureChange(e.target.value)}
                      placeholder="120,000"
                      dir="ltr"
                      className="w-20 sm:w-24 px-1.5 py-0.5 font-mono font-bold text-center border border-emerald-700 rounded-md bg-white focus:outline-hidden text-xs"
                    />
                    <input
                      type="text"
                      value={receivedWords}
                      onChange={(e) => setReceivedWords(e.target.value)}
                      placeholder="ایک لاکھ بیس ہزار"
                      dir="rtl"
                      className="flex-1 min-w-[120px] pr-3.5 pl-2.5 py-1 border border-slate-300 rounded-md bg-white text-rose-700 font-bold focus:outline-hidden text-right font-nastaliq text-xs"
                    />
                    <span className="font-bold text-[#064E3B]">انتظامیہ عمرہ کمیٹی سے وصول کر لی ہے۔</span>
                  </div>
                </div>
              </div>

              {/* Refund Description / Qist Details */}
              <div className="my-1.5 sm:my-2 bg-white p-2 sm:p-2.5 rounded-xl border-2 border-emerald-600/30 shadow-xs space-y-1" dir="rtl">
                <div className="flex items-center justify-between">
                  <label className="block text-right font-bold text-[#064E3B] font-nastaliq text-xs">
                    تفصیل برائے ریفنڈ / کونسی قسط ہے:
                  </label>
                  <span className="text-[10px] font-sans font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md" dir="ltr">
                    (Refund Purpose / Installment Detail)
                  </span>
                </div>
                <textarea
                  rows={1}
                  value={qistDescription}
                  onChange={(e) => setQistDescription(e.target.value)}
                  placeholder="مثلاً: قسط نمبر 1 تا 12، یا مکمل کمیٹی رقم برائے ریفنڈ / کینسلیشن..."
                  dir="rtl"
                  className="w-full pr-3.5 pl-2.5 py-1 text-slate-900 font-semibold border border-slate-300 rounded-lg focus:outline-hidden focus:border-emerald-600 focus:ring-1 focus:ring-emerald-500 text-right font-nastaliq min-h-[36px] resize-y text-xs leading-normal"
                />
              </div>
            </div>

            {/* SECTION 3: WADAH & UNDERTAKING TEXT IN NASTALIQ URDU */}
            <div className="mt-2.5 sm:mt-3 bg-amber-50/50 border border-amber-300/80 rounded-xl p-2.5 sm:p-3 space-y-2" dir="rtl">
              <div className="flex items-center justify-between border-b border-amber-200/80 pb-1">
                <span className="text-[10px] sm:text-[11px] font-bold text-amber-900 uppercase tracking-wider font-sans" dir="ltr">
                  Section 03 • Committee Undertaking & Member Feedback
                </span>
                <span className="text-xs sm:text-sm font-bold font-nastaliq text-amber-900">
                  الحمد للہ!
                </span>
              </div>

              {/* The Wadah statement in authentic Nastaliq Urdu */}
              <p className="font-nastaliq text-xs sm:text-[13px] text-slate-900 leading-relaxed text-justify">
                عمرہ کمیٹی نے معزز زائرین کی امانت شدہ رقوم واپس کر دی ہیں، اور کمیٹی نے اپنی ذمہ داریوں کو بحسن و خوبی انجام دیا ہے اور زائرین کے اعتماد کو برقرار رکھا ہے۔ اس طرح کی مثبت کارروائیاں یقیناً زائرین کے لیے اطمینان اور سکون کا باعث بنتی ہیں۔ کیا آپ انتظامیہ سے مطمئن ہیں؟
              </p>

              {/* Member Feedback Field */}
              <div className="pt-0.5">
                <label className="block text-right font-bold text-slate-800 mb-0.5 font-nastaliq text-xs">
                  برائے مہربانی اپنی رائے / اطمینان تحریر فرمائیں:
                </label>
                <input
                  type="text"
                  value={memberFeedback}
                  onChange={(e) => setMemberFeedback(e.target.value)}
                  placeholder="اپنی رائے یا تاثرات تحریر فرمائیں..."
                  dir="rtl"
                  className="w-full pr-3.5 pl-2.5 py-1 text-slate-900 border border-amber-300 rounded-lg bg-white focus:outline-hidden focus:border-emerald-600 text-right font-nastaliq text-xs"
                />
              </div>

              {/* Notice Note in Alert Red / Gold */}
              <div className="p-1.5 sm:p-2 bg-red-50 border border-red-200 rounded-lg text-[10.5px] sm:text-[11px] font-nastaliq text-red-700 leading-tight">
                <span className="font-bold text-red-800 text-xs">نوٹ: </span>
                <span>
                  براہ کرم اس ریفنڈ فارم کو بغور پڑھ کر اس پر اپنے دستخط کریں اور اس کی فوٹو کاپی عمرہ کمیٹی کی انتظامیہ کو واپس ارسال فرمائیں۔ شکریہ!
                </span>
              </div>
            </div>

            {/* SECTION 4: SIGNATURES & OFFICIAL STAMP */}
            <div className="mt-2.5 sm:mt-3 pt-1 relative">
              {/* Official Seal / Stamp */}
              <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none opacity-80 z-10 flex flex-col items-center justify-center">
                <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full border-2 border-dashed border-[#064E3B] bg-emerald-50/30 flex flex-col items-center justify-center text-center p-1.5 rotate-[-10deg]">
                  <span className="text-[6.5px] sm:text-[7.5px] font-black tracking-widest text-[#064E3B] uppercase">
                    M.Z.A UMRAH COMMITTEE
                  </span>
                  <div className="border-y border-[#064E3B] py-0.5 my-0.5 px-2 bg-white/70">
                    <span className="text-[9px] sm:text-[10px] font-black tracking-wider text-rose-700 uppercase whitespace-nowrap">
                      REFUND VERIFIED
                    </span>
                  </div>
                  <span className="text-[5.5px] sm:text-[6.5px] font-bold text-[#064E3B] uppercase">
                    ESTD. 2019 • TRUST
                  </span>
                </div>
              </div>

              {/* Signatures Row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-8 items-end relative z-20">
                {/* Admin Signature */}
                <div className="text-center space-y-1">
                  <div className="h-10 sm:h-12 flex items-end justify-center pb-0.5">
                    {adminSignature ? (
                      adminSignature.startsWith('data:image') ? (
                        <img src={adminSignature} alt="Admin Sign" className="max-h-10 sm:max-h-12 max-w-full object-contain" />
                      ) : (
                        <span className="font-serif italic font-bold text-emerald-950 text-xs sm:text-sm border-b-2 border-emerald-900 px-2.5 py-0.5 bg-emerald-50/50 rounded-md">
                          {adminSignature}
                        </span>
                      )
                    ) : (
                      <div className="w-full border-b border-slate-400 h-5 sm:h-6"></div>
                    )}
                  </div>
                  <div className="border-t-2 border-slate-800 pt-0.5 flex items-center justify-between text-xs font-bold text-slate-800">
                    <span className="font-nastaliq text-xs">دستخط انتظامیہ:</span>
                    <button
                      type="button"
                      onClick={() => setActiveSignTarget('admin')}
                      className="text-[9px] text-emerald-700 hover:text-emerald-900 underline flex items-center gap-1 cursor-pointer no-print font-sans"
                    >
                      <PenTool className="w-2.5 h-2.5" />
                      <span>Sign Karein</span>
                    </button>
                  </div>
                  <div className="text-[10px] flex items-center justify-start gap-1 pt-0.5 text-slate-600">
                    <span className="font-semibold">Issue Date:</span>
                    <input
                      type="text"
                      value={issueDate}
                      onChange={(e) => setIssueDate(e.target.value)}
                      placeholder="DD-MMM-YYYY"
                      className="w-20 sm:w-24 px-1.5 py-0.5 text-[10px] sm:text-[11px] font-mono border border-slate-300 rounded-md bg-white focus:outline-hidden"
                    />
                  </div>
                </div>

                {/* Member Signature */}
                <div className="text-center space-y-1" dir="rtl">
                  <div className="h-10 sm:h-12 flex items-end justify-center pb-0.5">
                    {memberSignature ? (
                      memberSignature.startsWith('data:image') ? (
                        <img src={memberSignature} alt="Member Sign" className="max-h-10 sm:max-h-12 max-w-full object-contain" />
                      ) : (
                        <span className="font-serif italic font-bold text-emerald-950 text-xs sm:text-sm border-b-2 border-emerald-900 px-2.5 py-0.5 bg-emerald-50/50 rounded-md">
                          {memberSignature}
                        </span>
                      )
                    ) : (
                      <div className="w-full border-b border-slate-400 h-5 sm:h-6"></div>
                    )}
                  </div>
                  <div className="border-t-2 border-slate-800 pt-0.5 flex items-center justify-between text-xs font-bold text-slate-800">
                    <span className="font-nastaliq text-xs">دستخط ممبر (Member Sign):</span>
                    <button
                      type="button"
                      onClick={() => setActiveSignTarget('member')}
                      className="text-[9px] text-emerald-700 hover:text-emerald-900 underline flex items-center gap-1 cursor-pointer no-print font-sans"
                    >
                      <PenTool className="w-2.5 h-2.5" />
                      <span>Sign Karein</span>
                    </button>
                  </div>
                  <p className="text-[8.5px] sm:text-[9.5px] text-slate-500 text-right pt-0.5 font-sans">
                    Physical pen or digital signature verification
                  </p>
                </div>
              </div>
            </div>

            {/* SECTION 5: خلاصہ کمیٹی و دفتری رابطہ (Footer Summary) */}
            <div className="mt-2.5 sm:mt-3 pt-2 border-t-2 border-slate-200 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3">
                {/* Left: Contact Info */}
                <div className="space-y-0.5 text-slate-700 bg-slate-50 p-2 sm:p-2.5 rounded-xl border border-slate-200/80">
                  <p className="font-bold text-[#064E3B] flex items-center gap-1.5 text-xs">
                    <BadgeCheck className="w-3.5 h-3.5 text-emerald-700" />
                    <span>M.Z.A Umrah Committee Welfare Pakistan</span>
                  </p>
                  <p className="text-slate-600 flex items-center gap-1 pt-0.5 text-[10.5px]">
                    <span className="font-semibold text-slate-700">Official Portal:</span>
                    <a
                      href="https://mz-umrah.vercel.app/"
                      target="_blank"
                      rel="noreferrer"
                      className="text-emerald-700 font-mono font-medium hover:underline"
                    >
                      https://mz-umrah.vercel.app/
                    </a>
                  </p>
                  <p className="text-slate-600 text-[10.5px]">
                    <span className="font-semibold text-slate-700">Helpline:</span>{' '}
                    <span className="font-mono">0321-8924033</span> •{' '}
                    <span className="font-semibold text-slate-700">WhatsApp:</span>{' '}
                    <span className="font-mono">0333-2179341</span>
                  </p>
                </div>

                {/* Right: Registration & Ledger Summary */}
                <div className="space-y-0.5 text-[10.5px] sm:text-xs bg-slate-50 p-2 sm:p-2.5 rounded-xl border border-slate-200/80">
                  <div className="flex justify-between items-center py-0.5 border-b border-slate-200">
                    <span className="font-medium text-slate-600">Registration Date:</span>
                    <input
                      type="text"
                      value={registrationDate}
                      onChange={(e) => setRegistrationDate(e.target.value)}
                      placeholder="01-Jan-2027"
                      className="w-24 sm:w-28 text-right font-mono text-emerald-900 font-bold border-b border-slate-300 bg-transparent focus:outline-hidden"
                    />
                  </div>
                  <div className="flex justify-between items-center py-0.5 border-b border-slate-200">
                    <span className="font-medium text-slate-600">Committee Plan:</span>
                    <input
                      type="text"
                      value={committeePeriod}
                      onChange={(e) => setCommitteePeriod(e.target.value)}
                      placeholder="24 Months / 36 Months"
                      className="w-24 sm:w-28 text-right font-semibold border-b border-slate-300 bg-transparent focus:outline-hidden"
                    />
                  </div>
                  <div className="flex justify-between items-center py-0.5 border-b border-slate-200">
                    <span className="font-medium text-slate-600">Monthly Installment:</span>
                    <input
                      type="text"
                      value={monthlyInstallment}
                      onChange={(e) => setMonthlyInstallment(e.target.value)}
                      placeholder="Rs. 5,000"
                      className="w-24 sm:w-28 text-right font-semibold border-b border-slate-300 bg-transparent focus:outline-hidden"
                    />
                  </div>
                  <div className="flex justify-between items-center py-0.5 border-b border-slate-200">
                    <span className="font-bold text-slate-800">Total Received:</span>
                    <input
                      type="text"
                      value={totalReceivedFigure}
                      onChange={(e) => setTotalReceivedFigure(e.target.value)}
                      placeholder="120,000"
                      className="w-24 sm:w-28 text-right font-mono font-black text-slate-900 border-b border-slate-300 bg-transparent focus:outline-hidden"
                    />
                  </div>
                  <div className="flex justify-between items-center py-0.5">
                    <span className="font-bold text-rose-700">Total Refunded:</span>
                    <input
                      type="text"
                      value={totalRefundFigure}
                      onChange={(e) => setTotalRefundFigure(e.target.value)}
                      placeholder="120,000"
                      className="w-24 sm:w-28 text-right font-mono font-black text-rose-700 border-b border-slate-300 bg-transparent focus:outline-hidden"
                    />
                  </div>
                </div>
              </div>

              {/* Head Office Address Box */}
              <div className="mt-2 p-1.5 sm:p-2 bg-slate-100 rounded-xl border border-slate-200/90 text-slate-700 flex items-start gap-2">
                <MapPin className="w-3.5 h-3.5 text-emerald-800 shrink-0 mt-0.5" />
                <p className="text-[10px] sm:text-[10.5px] leading-snug">
                  <strong className="text-slate-900">Main Head Office:</strong> House No. 37, 1st Floor, Tekri Colony, Bath Island, Block 7, near Teen Talwar, Clifton, Karachi, Pakistan.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Bottom Action Footer */}
        <div className="w-full bg-slate-50 p-3 sm:p-4 border-t border-slate-200 flex flex-wrap items-center justify-end gap-2.5 sm:gap-3 shrink-0 shadow-xs">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-200/80 rounded-xl transition-colors cursor-pointer text-center"
          >
            Close
          </button>

          <button
            type="button"
            disabled={isDownloadingPdf}
            onClick={handleDownloadPDF}
            className="px-4 sm:px-5 py-2 text-xs font-bold text-emerald-950 bg-emerald-100 hover:bg-emerald-200 border border-emerald-300 rounded-xl flex items-center justify-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{isDownloadingPdf ? 'Generating...' : 'Download PDF'}</span>
          </button>

          <button
            type="button"
            disabled={isSaving || isDownloadingPdf}
            onClick={handleSaveAndDownload}
            className="px-4 sm:px-5 py-2 text-xs font-bold text-white bg-[#064E3B] hover:bg-emerald-800 rounded-xl flex items-center justify-center gap-2 shadow-xs transition-colors cursor-pointer disabled:opacity-50"
          >
            <CheckCircle2 className="w-4 h-4 text-amber-300" />
            <span>Save Record & Download PDF</span>
          </button>
        </div>
      </div>

      {/* Signature Pad Popup */}
      {activeSignTarget && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs">
          <div className="bg-white rounded-2xl p-5 max-w-sm w-full space-y-4 shadow-2xl border border-slate-300">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200">
              <div className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <PenTool className="w-4 h-4 text-emerald-700" />
                <span>
                  {activeSignTarget === 'admin' ? 'دستخط برائے انتظامیہ (Admin Sign)' : 'دستخط برائے ممبر (Member Sign)'}
                </span>
              </div>
              <button
                onClick={() => setActiveSignTarget(null)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-500">
              Screen par mouse ya finger se dastakhat karein, ya text sign karein.
            </p>

            <div className="border-2 border-dashed border-emerald-300 rounded-xl overflow-hidden bg-slate-50 relative">
              <canvas
                ref={canvasRef}
                width={340}
                height={150}
                onMouseDown={startDrawing}
                onMouseMove={draw}
                onMouseUp={stopDrawing}
                onMouseLeave={stopDrawing}
                onTouchStart={startDrawing}
                onTouchMove={draw}
                onTouchEnd={stopDrawing}
                className="w-full h-36 cursor-crosshair touch-none"
              />
              <span className="absolute bottom-1 right-2 text-[10px] text-slate-400 pointer-events-none">
                Sign inside the box
              </span>
            </div>

            <div className="flex items-center justify-between gap-2 pt-2">
              <button
                type="button"
                onClick={clearCanvas}
                className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg flex items-center gap-1 cursor-pointer font-semibold"
              >
                <Eraser className="w-3.5 h-3.5" />
                <span>Clear</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    if (activeSignTarget === 'admin') {
                      setAdminSignature('Abdul Shakoor Madni (Admin)');
                    } else {
                      setMemberSignature(memberName || 'Member Sign');
                    }
                    setActiveSignTarget(null);
                  }}
                  className="px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-100 rounded-lg cursor-pointer font-semibold"
                >
                  Text Sign
                </button>
                <button
                  type="button"
                  onClick={saveCanvasSignature}
                  className="px-4 py-1.5 text-xs bg-[#064E3B] hover:bg-emerald-800 text-white font-bold rounded-lg cursor-pointer"
                >
                  Save Signature
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
