import Image from 'next/image';

const LOGO_SRC = '/stampogen-logo-white.png';

export function StampogenLogo({
  variant = 'light',
  className = '',
  width = 180,
  height = 180,
  priority = false,
}) {
  const isDarkBg = variant === 'light';

  return (
    <div className={`inline-flex items-center justify-center ${className}`}>
      <Image
        src={LOGO_SRC}
        alt="Stampogen"
        width={width}
        height={height}
        priority={priority}
        className={`h-auto w-full object-contain ${isDarkBg ? '' : 'brightness-0'}`}
        style={{ maxWidth: width }}
      />
    </div>
  );
}
