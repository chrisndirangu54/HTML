$(function(){

    $(window).on('load', function () {
        $('.page-loader').delay('500').fadeOut(1000);
    });

    $(document).ready(function() {

        // Toggle sidebar on hamburger click (open if closed, close if open)
        $(document).on('click', '.icon-menu', function(e) {
            e.preventDefault();
            $('.responsive-sidebar-menu').toggleClass('active');
        });

        // Close on overlay click
        $(document).on('click', '.responsive-sidebar-menu .overlay', function() {
            $('.responsive-sidebar-menu').removeClass('active');
        });

        // Close on any menu item or social link click (expanded from just .scroll-to)
        $(document).on('click', '.responsive-sidebar-menu .menu li a, .responsive-sidebar-menu .sidebar-social ul li a', function(e) {
            $('.responsive-sidebar-menu').removeClass('active');
            // Optional: Smooth scroll if it's a nav link
            if ($(this).hasClass('scroll-to') || $(this).attr('href')) {
                // Add your scroll logic here if needed
            }
        });

        // Color box active toggle
        $(document).on('click', ".color-boxed a", function() {
            $(".color-boxed a").removeClass("clr-active");
            $(this).addClass("clr-active");
        });
        
        // Open global color settings
        $(document).on('click', ".global-color .setting-toggle", function() {
            $(".global-color").addClass("active");
        });

        // Close global color settings
        $(document).on('click', ".global-color .inner .overlay, .global-color .inner .global-color-option .close-settings", function() {
            $(".global-color").removeClass("active");
        });

    });

    // Removed scroll spy to avoid conflicts with fixed menu's vanilla JS activation (IntersectionObserver handles it more efficiently)







    // Testimonial Slider

    if ($('.testimonial-slider').length) {
        var testimonial = $('.testimonial-slider').owlCarousel({
            items: 1,
            margin: 30,
            stagePadding: 0,
            smartSpeed: 450,
            autoHeight: true,
            loop: true,
            nav: false,
            dots: false,
            autoplay: true,
            autoplayTimeout: 5000,
            autoplayHoverPause: true,
            onInitialized  : counter, //When the plugin has initialized.
            onTranslated : counter //When the translation of the stage has finished.
        });

        $('.testimonial-nav .next').on('click', function() {
            testimonial.trigger('next.owl.carousel');
        })
        $('.testimonial-nav .prev').on('click', function() {
            testimonial.trigger('prev.owl.carousel', [300]);
        })


        function counter(event) {
            var element   = event.target;         // DOM element, in this example .owl-carousel
            var items     = event.item.count;     // Number of items
            var item      = event.item.index + 1;     // Position of the current item
        
        // it loop is true then reset counter from 1
        if(item > items) {
                item = item - items
        }
        $('#testimonial-slide-count').html("<span class='left'>"+item+"</span> / "+items)
        }
    }

    // function remove_is_active() {
    //     $(".menu .scroll-to").removeClass("active");
    // }

    // gsap.registerPlugin(ScrollTrigger, ScrollToPlugin);

    // var container = document.querySelector("#smooth-content");

    // var height;
    // function setHeight() {
    //     height = container.clientHeight;


    //     document.body.style.height = height + "px";
    // }
    // ScrollTrigger.addEventListener("refreshInit", setHeight);

    // gsap.to(container, {
    //     y: () => -(height - document.documentElement.clientHeight),
    //     ease: "none",
    //     scrollTrigger: {
    //         trigger: container,
    //         start: "top top",
    //         end: "bottom bottom",
    //         scrub: 1,
    //         invalidateOnRefresh: true,
    //     }
    // });

    window.addEventListener('scroll', {
        scroll_animations,
    });


    // Array.prototype.slice.call(document.querySelectorAll(".page-section")).forEach(function (e, t) {
    //     ScrollTrigger.create({
    //         trigger: e,
    //         id: t + 1,
    //         start: "top center",
    //         end: function () {
    //             return "+=".concat(e.clientHeight - 30);
    //         },
    //         toggleActions: "play reverse none reverse",
    //         toggleClass: { targets: e, className: "active" },
    //         onToggle: function () {
    //             $(".menu .scroll-to").removeClass("active"), "" != e.id && $('.menu .scroll-to[href*="#' + e.id + '"]').addClass("active");
    //         },
    //     });
    // });

    // document.querySelectorAll('.scroll-to').forEach((e) => {
    //     const target = e.getAttribute('href');
    //     const targetEl = document.querySelector(target);
    //     // const targetRect = targetEl.getBoundingClientRect();


    //     var offset = gsap.getProperty("#smooth-content", "y");
    //     var position = jQuery(target).get(0).getBoundingClientRect().top - offset;
    

    //     e.addEventListener('click', (e) => {
    //         e.preventDefault();

    //         gsap.to(window, {
    //             scrollTo: position,
    //             ease: "power4",
    //             duration: 0.1,
    //             onToggle: function () {
    //                 console.log('toggle');
    //                 remove_is_active();
    //                 if (targetEl.id != "") $('.menu .scroll-to[href*="#' + targetEl.id + '"]').addClass("active");
    //             },
    //             onLeaveBack: function () {
    //                 console.log('leave back');
    //                 remove_is_active();
    //                 if (targetEl.id != "") $('.menu .scroll-to[href*="#' + targetEl.id + '"]').addClass("active");
    //             },
    //             onLeave: function () {
    //                 console.log('leave');
    //                 remove_is_active();
    //                 if (targetEl.id != "") $('.menu .scroll-to[href*="#' + targetEl.id + '"]').addClass("active");
    //             },
    //             overwrite: !0,
    //         });
    //     });

        
    
    // });

});

function toggleTopMobileMenu() {
    const mobileMenu = document.getElementById('topMobileMenu');
    const hamburger = document.querySelector('.top-hamburger');
    
    if (mobileMenu.style.display === 'flex') {
        mobileMenu.style.display = 'none';
        hamburger.classList.remove('active');
    } else {
        mobileMenu.style.display = 'flex';
        hamburger.classList.add('active');
    }
}

// Optional: Close menu on window resize (if desktop)
window.addEventListener('resize', function() {
    if (window.innerWidth > 600) {
        document.getElementById('topMobileMenu').style.display = 'none';
        document.querySelector('.top-hamburger').classList.remove('active');
    }
});

// Optional: Close on menu link click
document.querySelectorAll('.top-mobile-menu a').forEach(link => {
    link.addEventListener('click', toggleTopMobileMenu);
});
function handleMobileNavbar() {
    const isMobile = window.innerWidth <= 600;
    const topMenu = document.getElementById('topMenu');
    const hamburger = document.querySelector('.top-hamburger');
    const mobileMenu = document.getElementById('topMobileMenu');
    
    if (isMobile) {
        topMenu.style.display = 'none';  // Hide desktop menu
        hamburger.style.display = 'flex';  // Show hamburger
        hamburger.style.marginLeft = 'auto';  // Push to right
        hamburger.style.zIndex = '1001';
        hamburger.style.pointerEvents = 'auto';
        mobileMenu.style.display = 'none';  // Ensure closed initially
    } else {
        topMenu.style.display = 'flex';  // Show desktop menu
        hamburger.style.display = 'none';  // Hide hamburger
        mobileMenu.style.display = 'none';
    }
}



function scroll_animations() {
    // var allow_on_mobile = !0;
    // if (typeof config_scroll_animation_on_mobile !== "undefined") allow_on_mobile = config_scroll_animation_on_mobile;
    // if (allow_on_mobile == !1 && is_mobile_device) return;
    var defaults = {
        duration: 1.2,
        ease: "power4.out",
        animation: "fade_from_bottom",
        once: !1,
    };
    gsap.utils.toArray(".scroll-animation").forEach(function (box) {
        var gsap_obj = {};
        var settings = {
            // ease: box.dataset.animationEase || defaults.ease,
            duration: box.dataset.animationDuration || defaults.duration,
        };
        var animations = {
            fade_from_bottom: {
                y: 180,
                opacity: 0,
            },
            fade_from_top: {
                y: -180,
                opacity: 0,
            },
            fade_from_left: {
                x: -180,
                opacity: 0,
            },
            fade_from_right: {
                x: 180,
                opacity: 0,
            },
            fade_in: {
                opacity: 0,
            },
            rotate_up: {
                y: 180,
                rotation: 10,
                opacity: 0,
            },
        };
        var scroll_trigger = {
            scrollTrigger: {
                trigger: box,
                once: defaults.once,
                start: "top bottom+=20%",
                // start: "top bottom+=5%",
                toggleActions: "play none none reverse",
                markers: !1,
            },
        };
        jQuery.extend(gsap_obj, settings);
        jQuery.extend(gsap_obj, animations[box.dataset.animation || defaults.animation]);
        jQuery.extend(gsap_obj, scroll_trigger);
        gsap.from(box, gsap_obj);
    });
}
scroll_animations();
