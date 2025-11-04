(function ($) {
    'use strict';
    var form = $('.contact-form'),
        message = $('.messenger-box-contact__msg'),
        alertElement = $('.alert', form); // Reference to the alert div

    // Success function
    function done_func(response) {
        if (response.status === 'success') {
            alertElement.fadeIn().removeClass('alert-danger').addClass('alert-success');
            alertElement.text(response.message || 'Your message was sent successfully.');
            setTimeout(function () {
                alertElement.fadeOut();
            }, 3000);
            form.find('input:not([type="submit"]), textarea, select').val('');
            form[0].reset(); // Reset file input as well
        } else {
            // Handle validation or other errors from Formcarry
            fail_func({ responseText: response.message || 'An error occurred. Please try again.' });
        }
    }

    // Fail function
    function fail_func(data) {
        var errorMsg = 'An unexpected error occurred. Please try again.';
        if (data.responseJSON && data.responseJSON.message) {
            errorMsg = data.responseJSON.message;
        } else if (data.responseText) {
            errorMsg = data.responseText;
        }
        alertElement.fadeIn().removeClass('alert-success').addClass('alert-danger');
        alertElement.text(errorMsg);
        setTimeout(function () {
            alertElement.fadeOut();
        }, 3000);
    }
    
    form.submit(function (e) {
        e.preventDefault();

        var requiredMsg = document.getElementById('required-msg');
        var fullName = document.getElementById("full-name");
        var email = document.getElementById("email");
        var subject = document.getElementById("subject");
        var messageText = document.getElementById("message"); // Assuming message is required

        // Reset previous invalid classes
        fullName.classList.remove("invalid");
        email.classList.remove("invalid");
        subject.classList.remove("invalid");
        messageText.classList.remove("invalid");

        var isValid = true;
        var invalidFields = [];

        if (!fullName.value.trim()) {
            invalidFields.push(fullName);
            isValid = false;
        }
        if (!email.value.trim()) {
            invalidFields.push(email);
            isValid = false;
        }
        if (!subject.value) {
            invalidFields.push(subject);
            isValid = false;
        }
        if (!messageText.value.trim()) {
            invalidFields.push(messageText);
            isValid = false;
        }

        if (!isValid) {
            requiredMsg.classList.add('show');
            invalidFields.forEach(function(field) {
                field.classList.add("invalid");
            });
            return false;
        }
        requiredMsg.classList.remove('show');

        // Use FormData to handle file uploads
        var formData = new FormData(this);

        $.ajax({
            type: 'POST',
            url: form.attr('action'),
            data: formData,
            processData: false,  // Required for FormData
            contentType: false,  // Required for FormData
            dataType: 'json',    // Expect JSON response from Formcarry
            cache: false
        })
        .done(done_func)
        .fail(fail_func);
    });
    
})(jQuery);
