import { useEffect, useState } from 'react';
function BackToTop() {
  const [showButton, setShowButton] = useState(false);
  useEffect(() => {
    function handleScroll() {
      if (window.scrollY > 200) {
        setShowButton(true);
      } else {
        setShowButton(false);
      }
    }
    window.addEventListener('scroll', handleScroll);
    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);
  function scrollTop() {
    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    });
  }
  return (
    <>
      {showButton && (
        <button
          onClick={scrollTop}
          className="fixed bottom-20 right-5 bg-blue-600 text-white px-4 py-2 rounded-full z-50"
        >
          ↑
        </button>
      )}
    </>
  );
}
export default BackToTop;
